import {
  EvaluationIssue,
  NtfsScenario,
  ScenarioCategory,
  ScenarioEvaluation,
  VirtualFolderNode,
} from '../types/ntfs';
import { computeEffectivePermissions } from '../utils/ntfsEngine';
import { NTFS_SCENARIOS, verifyNetworkShareAvailable } from './scenarios';

const RX_PERMS = [
  'traverse',
  'listRead',
  'readAttributes',
  'readExtendedAttributes',
  'readPermissions',
] as const;

const FULL_PERMS = [
  'fullControl',
  'traverse',
  'listRead',
  'readAttributes',
  'readExtendedAttributes',
  'createFilesWriteData',
  'createFoldersAppendData',
  'writeAttributes',
  'writeExtendedAttributes',
  'deleteSubfoldersAndFiles',
  'delete',
  'readPermissions',
  'changePermissions',
  'takeOwnership',
] as const;

const MODIFY_PERMS = [
  'traverse',
  'listRead',
  'readAttributes',
  'readExtendedAttributes',
  'createFilesWriteData',
  'createFoldersAppendData',
  'writeAttributes',
  'writeExtendedAttributes',
  'delete',
  'readPermissions',
] as const;

function buildEval(issues: EvaluationIssue[]): ScenarioEvaluation {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const passed = errors.length === 0;
  const successes = issues.filter((i) => i.severity === 'success').length;
  const score = passed
    ? Math.max(100 - warnings.length * 10, 80)
    : Math.max(Math.round((successes / Math.max(issues.length, 1)) * 60), 0);

  return {
    passed,
    score,
    maxScore: 100,
    summary: passed
      ? 'Configuración válida: cumple todos los requisitos del enunciado.'
      : `Faltan ${errors.length} ${errors.length === 1 ? 'requisito' : 'requisitos'} por corregir.`,
    issues,
  };
}

interface DomainTheme {
  machine: string;
  sector: string;
  rootFolder: string;
  dropFolder: string;
  enunciadoFolder: string;
  archiveFolder: string;
  projectFolder: string;
  logFolder: string;
  scriptFolder: string;
  secretFolder: string;
  groupPrimary: string;
  groupLead: string;
  groupSupervisor: string;
  groupRestricted: string;
  sampleFile1: string;
  sampleFile2: string;
  sampleSubfolder: string;
  sampleScript: string;
  sampleLog: string;
}

const DOMAIN_THEMES: DomainTheme[] = [
  {
    machine: 'SRV_AULA1',
    sector: 'Centro FP Informática',
    rootFolder: 'Modulos',
    dropFolder: 'Buzon_Examenes',
    enunciadoFolder: 'Enunciado_Actual',
    archiveFolder: 'Entrega_Tareas',
    projectFolder: 'Proyecto_ASIR',
    logFolder: 'Registros_Lab',
    scriptFolder: 'Utilidades_Red',
    secretFolder: 'Calificaciones',
    groupPrimary: 'Estudiantes',
    groupLead: 'Docente',
    groupSupervisor: 'JefaturaEstudios',
    groupRestricted: 'Repetidores',
    sampleFile1: 'examen_prueba.pdf',
    sampleFile2: 'rubrica.docx',
    sampleSubfolder: 'Evaluadas',
    sampleScript: 'configurar_ip.bat',
    sampleLog: 'actividad.log',
  },
  {
    machine: 'SRV_CLINICA',
    sector: 'Clínica San Lucas',
    rootFolder: 'Historial',
    dropFolder: 'Buzon_Analiticas',
    enunciadoFolder: 'Protocolo_Vigente',
    archiveFolder: 'Informes_Medicos',
    projectFolder: 'Ensayo_Cardio',
    logFolder: 'Bitacora_Guardias',
    scriptFolder: 'Visor_DICOM',
    secretFolder: 'Facturacion_Privada',
    groupPrimary: 'Enfermeria',
    groupLead: 'JefeServicio',
    groupSupervisor: 'DireccionMedica',
    groupRestricted: 'PracticasMed',
    sampleFile1: 'analitica_041.pdf',
    sampleFile2: 'tratamiento.docx',
    sampleSubfolder: 'Revisados',
    sampleScript: 'arrancar_visor.exe',
    sampleLog: 'incidencias_turno.log',
  },
  {
    machine: 'SRV_ARQ',
    sector: 'Estudio Trazos Arquitectura',
    rootFolder: 'Obras',
    dropFolder: 'Entrega_Planos',
    enunciadoFolder: 'Normativa_CTE',
    archiveFolder: 'Memorias_Obra',
    projectFolder: 'Torre_Norte',
    logFolder: 'Diario_Obra',
    scriptFolder: 'Conversor_CAD',
    secretFolder: 'Licitaciones',
    groupPrimary: 'Delineantes',
    groupLead: 'ArquitectoJefe',
    groupSupervisor: 'Socios',
    groupRestricted: 'BecariosCAD',
    sampleFile1: 'alzado_v2.dwg',
    sampleFile2: 'mediciones.xlsx',
    sampleSubfolder: 'Visados',
    sampleScript: 'exportar_dwg.bat',
    sampleLog: 'registro_visitas.txt',
  },
  {
    machine: 'SRV_FISCAL',
    sector: 'Asesoría Navarro & Asoc.',
    rootFolder: 'Clientes',
    dropFolder: 'Subida_Facturas',
    enunciadoFolder: 'Plantilla_IVA',
    archiveFolder: 'Declaraciones',
    projectFolder: 'Auditoria_2026',
    logFolder: 'Apuntes_Caja',
    scriptFolder: 'Generador_303',
    secretFolder: 'Nominas_Internas',
    groupPrimary: 'Contables',
    groupLead: 'SocioFiscal',
    groupSupervisor: 'Inspectores',
    groupRestricted: 'Auxiliares',
    sampleFile1: 'modelo_303.pdf',
    sampleFile2: 'balance.xlsx',
    sampleSubfolder: 'Presentadas',
    sampleScript: 'validar_nif.exe',
    sampleLog: 'movimientos_diarios.log',
  },
  {
    machine: 'SRV_PLANT1',
    sector: 'Fábrica Automoción Levant',
    rootFolder: 'Produccion',
    dropFolder: 'Partes_Calidad',
    enunciadoFolder: 'Ficha_Seguridad',
    archiveFolder: 'Incidencias_Linea',
    projectFolder: 'Linea_Baterias',
    logFolder: 'Eventos_PLC',
    scriptFolder: 'Test_Sensores',
    secretFolder: 'Costes_Proveedor',
    groupPrimary: 'Operarios',
    groupLead: 'JefePlanta',
    groupSupervisor: 'CalidadGlobal',
    groupRestricted: 'Temporales',
    sampleFile1: 'lote_882.csv',
    sampleFile2: 'especificacion.pdf',
    sampleSubfolder: 'Cerradas',
    sampleScript: 'calibrar.exe',
    sampleLog: 'lecturas_plc.log',
  },
  {
    machine: 'SRV_AYTO',
    sector: 'Ayuntamiento Villafranca',
    rootFolder: 'Expedientes',
    dropFolder: 'Registro_Entrada',
    enunciadoFolder: 'Bando_Actual',
    archiveFolder: 'Solicitudes',
    projectFolder: 'Plan_Urbano',
    logFolder: 'Actas_Registro',
    scriptFolder: 'Firma_Padron',
    secretFolder: 'Sanciones',
    groupPrimary: 'Administrativos',
    groupLead: 'Secretario',
    groupSupervisor: 'Intervencion',
    groupRestricted: 'Interinos',
    sampleFile1: 'instancia_209.pdf',
    sampleFile2: 'decreto.docx',
    sampleSubfolder: 'Resueltas',
    sampleScript: 'sellar_pdf.bat',
    sampleLog: 'entradas_sede.log',
  },
  {
    machine: 'SRV_LOGISTICA',
    sector: 'TransExpress Levante',
    rootFolder: 'Rutas',
    dropFolder: 'Albaranes_Chofer',
    enunciadoFolder: 'Tarifa_Vigente',
    archiveFolder: 'Hojas_Ruta',
    projectFolder: 'Flota_Sur',
    logFolder: 'GPS_Eventos',
    scriptFolder: 'Etiquetadora',
    secretFolder: 'Margenes_Ruta',
    groupPrimary: 'Coordinadores',
    groupLead: 'JefeTrafico',
    groupSupervisor: 'Gerencia',
    groupRestricted: 'Subcontratas',
    sampleFile1: 'albaran_91.pdf',
    sampleFile2: 'carga.xlsx',
    sampleSubfolder: 'Facturados',
    sampleScript: 'imprimir_etiqueta.exe',
    sampleLog: 'trazas_envios.log',
  },
  {
    machine: 'SRV_UNI',
    sector: 'Universidad Politécnica',
    rootFolder: 'Departamentos',
    dropFolder: 'Buzon_TFG',
    enunciadoFolder: 'Guia_TFG',
    archiveFolder: 'Practicas_Lab',
    projectFolder: 'Investigacion_IA',
    logFolder: 'Ejecuciones_Cluster',
    scriptFolder: 'Compilador_C',
    secretFolder: 'Actas_Tribunal',
    groupPrimary: 'Doctorandos',
    groupLead: 'InvestigadorPrincipal',
    groupSupervisor: 'Decanato',
    groupRestricted: 'BecariosGrado',
    sampleFile1: 'memoria_tfg.pdf',
    sampleFile2: 'dataset.csv',
    sampleSubfolder: 'Corregidos',
    sampleScript: 'lanzar_sim.bat',
    sampleLog: 'cluster_jobs.log',
  },
  {
    machine: 'SRV_BUFETE',
    sector: 'Bufete Ortiz Penalista',
    rootFolder: 'Casos',
    dropFolder: 'Pruebas_Peritos',
    enunciadoFolder: 'Minuta_Base',
    archiveFolder: 'Escritos_Juzgado',
    projectFolder: 'Caso_Mercantil',
    logFolder: 'Historial_Vistas',
    scriptFolder: 'Anonimizador',
    secretFolder: 'Honorarios',
    groupPrimary: 'Abogados',
    groupLead: 'SocioDirector',
    groupSupervisor: 'AuditoresLegales',
    groupRestricted: 'Pasantes',
    sampleFile1: 'demanda_04.docx',
    sampleFile2: 'anexo_pericial.pdf',
    sampleSubfolder: 'Notificados',
    sampleScript: 'limpiar_metadatos.exe',
    sampleLog: 'accesos_expediente.log',
  },
  {
    machine: 'SRV_RRHH',
    sector: 'Corporación Talentum',
    rootFolder: 'Personal',
    dropFolder: 'Buzon_CV',
    enunciadoFolder: 'Convenio_Actual',
    archiveFolder: 'Evaluaciones',
    projectFolder: 'Seleccion_2026',
    logFolder: 'Fichajes_Registro',
    scriptFolder: 'Calc_Finiquito',
    secretFolder: 'Salarios_Directivos',
    groupPrimary: 'TecnicosRRHH',
    groupLead: 'DirectorRRHH',
    groupSupervisor: 'ComiteEmpresa',
    groupRestricted: 'Etts',
    sampleFile1: 'cv_candidato.pdf',
    sampleFile2: 'entrevista.docx',
    sampleSubfolder: 'Entrevistados',
    sampleScript: 'exportar_nomina.bat',
    sampleLog: 'altas_bajas.log',
  },
  {
    machine: 'SRV_DISENO',
    sector: 'Estudio Pixel & Marca',
    rootFolder: 'Campanas',
    dropFolder: 'Artes_Finales',
    enunciadoFolder: 'Manual_Estilo',
    archiveFolder: 'Bocetos_Cliente',
    projectFolder: 'Marca_Verano',
    logFolder: 'Cambios_Prensa',
    scriptFolder: 'Optimizador_SVG',
    secretFolder: 'Presupuestos_VIP',
    groupPrimary: 'Disenadores',
    groupLead: 'DirectorArte',
    groupSupervisor: 'Cuentas',
    groupRestricted: 'Freelance',
    sampleFile1: 'cartel_final.pdf',
    sampleFile2: 'paleta.ase',
    sampleSubfolder: 'Aprobados',
    sampleScript: 'comprimir_img.exe',
    sampleLog: 'render_cola.log',
  },
  {
    machine: 'SRV_HOTEL',
    sector: 'Hotel Costa Blanca',
    rootFolder: 'Recepcion',
    dropFolder: 'Partes_Viajeros',
    enunciadoFolder: 'Tarifario_Hoy',
    archiveFolder: 'Reservas_Grupos',
    projectFolder: 'Congreso_Mayo',
    logFolder: 'Incidencias_Turnos',
    scriptFolder: 'Checkin_Policia',
    secretFolder: 'Cierre_Caja',
    groupPrimary: 'Recepcionistas',
    groupLead: 'JefeRecepcion',
    groupSupervisor: 'DireccionHotel',
    groupRestricted: 'RefuerzoVerano',
    sampleFile1: 'parte_policia.xml',
    sampleFile2: 'rooming_list.xlsx',
    sampleSubfolder: 'Confirmadas',
    sampleScript: 'enviar_hospederias.bat',
    sampleLog: 'turnos_noche.log',
  },
  {
    machine: 'SRV_MEDIA',
    sector: 'Emisora Onda Sur',
    rootFolder: 'Programas',
    dropFolder: 'Cortes_Audio',
    enunciadoFolder: 'Escaleta_Dia',
    archiveFolder: 'Podcasts_Emitidos',
    projectFolder: 'Especial_Elecciones',
    logFolder: 'Emision_Parrilla',
    scriptFolder: 'Normalizador_WAV',
    secretFolder: 'Contratos_Publicidad',
    groupPrimary: 'Redactores',
    groupLead: 'JefeEmisiones',
    groupSupervisor: 'Produccion',
    groupRestricted: 'Colaboradores',
    sampleFile1: 'entrevista_master.wav',
    sampleFile2: 'guion.docx',
    sampleSubfolder: 'Emitidos',
    sampleScript: 'convertir_mp3.exe',
    sampleLog: 'registro_emision.log',
  },
  {
    machine: 'SRV_SEGUROS',
    sector: 'Seguros Mediterráneo',
    rootFolder: 'Polizas',
    dropFolder: 'Partes_Siniestro',
    enunciadoFolder: 'Baremo_Vigente',
    archiveFolder: 'Peritajes',
    projectFolder: 'Siniestro_Nave',
    logFolder: 'Llamadas_Asistencia',
    scriptFolder: 'Calculo_Prima',
    secretFolder: 'Reservas_Tecnicas',
    groupPrimary: 'Tramitadores',
    groupLead: 'JefeSiniestros',
    groupSupervisor: 'Actuarios',
    groupRestricted: 'AgentesExternos',
    sampleFile1: 'parte_amistoso.pdf',
    sampleFile2: 'fotos_perito.zip',
    sampleSubfolder: 'Cerrados',
    sampleScript: 'tasar_danos.exe',
    sampleLog: 'bitacora_siniestros.log',
  },
  {
    machine: 'SRV_LAB_ID',
    sector: 'BioTech Valencia',
    rootFolder: 'Ensayos',
    dropFolder: 'Muestras_Brutas',
    enunciadoFolder: 'Protocolo_ISO',
    archiveFolder: 'Resultados_Lab',
    projectFolder: 'Proyecto_Enzima',
    logFolder: 'Registro_Estufas',
    scriptFolder: 'Analizador_PCR',
    secretFolder: 'Patentes',
    groupPrimary: 'Analistas',
    groupLead: 'DirectorLab',
    groupSupervisor: 'GarantiaCalidad',
    groupRestricted: 'VisitantesLab',
    sampleFile1: 'cromatograma.csv',
    sampleFile2: 'informe_pcr.pdf',
    sampleSubfolder: 'Validados',
    sampleScript: 'procesar_pcr.bat',
    sampleLog: 'temperaturas.log',
  },
  {
    machine: 'SRV_EDITORIAL',
    sector: 'Editorial Páginas Vivas',
    rootFolder: 'Colecciones',
    dropFolder: 'Manuscritos',
    enunciadoFolder: 'Guia_Correccion',
    archiveFolder: 'Pruebas_Imprenta',
    projectFolder: 'Novela_Otono',
    logFolder: 'Control_Tiradas',
    scriptFolder: 'Maquetador_EPUB',
    secretFolder: 'Derechos_Autor',
    groupPrimary: 'Correctores',
    groupLead: 'EditorJefe',
    groupSupervisor: 'ComiteEditorial',
    groupRestricted: 'LectoresExternos',
    sampleFile1: 'capitulo_01.docx',
    sampleFile2: 'galeradas.pdf',
    sampleSubfolder: 'Maquetados',
    sampleScript: 'generar_epub.exe',
    sampleLog: 'cambios_edicion.log',
  },
  {
    machine: 'SRV_ECOM',
    sector: 'TiendaOnline Direct',
    rootFolder: 'Catalogo',
    dropFolder: 'Pedidos_CSV',
    enunciadoFolder: 'Tarifa_Flash',
    archiveFolder: 'Devoluciones',
    projectFolder: 'BlackFriday',
    logFolder: 'Webhook_Pagos',
    scriptFolder: 'Sincro_Stock',
    secretFolder: 'Margenes_Netos',
    groupPrimary: 'GestoresTienda',
    groupLead: 'ResponsableEcom',
    groupSupervisor: 'Contabilidad',
    groupRestricted: 'SoporteN1',
    sampleFile1: 'stock_diario.csv',
    sampleFile2: 'incidencia_pedido.pdf',
    sampleSubfolder: 'Tramitado',
    sampleScript: 'subir_precios.bat',
    sampleLog: 'pasarela_pagos.log',
  },
  {
    machine: 'SRV_CONST',
    sector: 'Constructora Levante',
    rootFolder: 'Licitaciones',
    dropFolder: 'Ofertas_Subcontrata',
    enunciadoFolder: 'Pliego_Actual',
    archiveFolder: 'Certificaciones',
    projectFolder: 'Puente_Este',
    logFolder: 'Partes_Maquinaria',
    scriptFolder: 'Mediciones_BC3',
    secretFolder: 'Costes_Reales',
    groupPrimary: 'JefesObra',
    groupLead: 'DirectorTecnico',
    groupSupervisor: 'ControlGestion',
    groupRestricted: 'Subcontratistas',
    sampleFile1: 'oferta_hormigon.pdf',
    sampleFile2: 'certificacion_03.xlsx',
    sampleSubfolder: 'Aprobadas',
    sampleScript: 'importar_bc3.exe',
    sampleLog: 'horas_grua.log',
  },
  {
    machine: 'SRV_FARMA',
    sector: 'Laboratorios Farmasur',
    rootFolder: 'Lotes',
    dropFolder: 'Controles_Lote',
    enunciadoFolder: 'Formula_Maestra',
    archiveFolder: 'Trazabilidad',
    projectFolder: 'Jarabe_Infantil',
    logFolder: 'Registro_SalaBlanca',
    scriptFolder: 'Validador_AEMPS',
    secretFolder: 'Precios_Compra',
    groupPrimary: 'Farmaceuticos',
    groupLead: 'DirectorTecnico',
    groupSupervisor: 'InspectoresQA',
    groupRestricted: 'AlmacenAux',
    sampleFile1: 'lote_f902.pdf',
    sampleFile2: 'ensayo_estabilidad.xlsx',
    sampleSubfolder: 'Liberados',
    sampleScript: 'firmar_lote.exe',
    sampleLog: 'presion_salas.log',
  },
  {
    machine: 'SRV_CONSERV',
    sector: 'Conservatorio Superior',
    rootFolder: 'Audiciones',
    dropFolder: 'Grabaciones_Prueba',
    enunciadoFolder: 'Obra_Obligada',
    archiveFolder: 'Partituras_Aula',
    projectFolder: 'Concierto_FinCurso',
    logFolder: 'Reserva_Cabinas',
    scriptFolder: 'Afinador_MIDI',
    secretFolder: 'Actas_Oposicion',
    groupPrimary: 'Alumnado',
    groupLead: 'Catedratico',
    groupSupervisor: 'Claustro',
    groupRestricted: 'Oyentes',
    sampleFile1: 'audicion_piano.mp3',
    sampleFile2: 'partitura_violin.pdf',
    sampleSubfolder: 'Seleccionadas',
    sampleScript: 'convertir_midi.bat',
    sampleLog: 'uso_aulas.log',
  },
  {
    machine: 'SRV_BIBLIO',
    sector: 'Biblioteca Central',
    rootFolder: 'Fondos',
    dropFolder: 'Desideratas',
    enunciadoFolder: 'Normas_Prestamo',
    archiveFolder: 'Catalogacion',
    projectFolder: 'Digitalizacion_XIX',
    logFolder: 'Prestamos_Dia',
    scriptFolder: 'OCR_Manuscritos',
    secretFolder: 'Donaciones_Privadas',
    groupPrimary: 'Bibliotecarios',
    groupLead: 'DirectorBiblioteca',
    groupSupervisor: 'Patrimonio',
    groupRestricted: 'Voluntarios',
    sampleFile1: 'peticion_libro.txt',
    sampleFile2: 'ficha_marc21.xml',
    sampleSubfolder: 'Catalogados',
    sampleScript: 'ejecutar_ocr.exe',
    sampleLog: 'movimientos_sala.log',
  },
  {
    machine: 'SRV_DEPORTES',
    sector: 'Polideportivo Municipal',
    rootFolder: 'Escuelas',
    dropFolder: 'Autorizaciones',
    enunciadoFolder: 'Reglamento_Pistas',
    archiveFolder: 'Fichas_Medicas',
    projectFolder: 'Torneo_Verano',
    logFolder: 'Accesos_Torno',
    scriptFolder: 'Generar_Carnets',
    secretFolder: 'Cuotas_Impagadas',
    groupPrimary: 'Monitores',
    groupLead: 'CoordinadorDeportes',
    groupSupervisor: 'Concejalia',
    groupRestricted: 'SocorristasTemp',
    sampleFile1: 'autorizacion_menor.pdf',
    sampleFile2: 'cuadrante_pistas.xlsx',
    sampleSubfolder: 'Validadas',
    sampleScript: 'imprimir_carnet.exe',
    sampleLog: 'torniquetes.log',
  },
  {
    machine: 'SRV_TELECO',
    sector: 'Operadora FibraNet',
    rootFolder: 'Nodos',
    dropFolder: 'Trazas_Averia',
    enunciadoFolder: 'Topologia_Actual',
    archiveFolder: 'Instalaciones',
    projectFolder: 'Despliegue_FTTH',
    logFolder: 'Syslog_Routers',
    scriptFolder: 'Provision_ONT',
    secretFolder: 'Claves_BGP',
    groupPrimary: 'TecnicosRed',
    groupLead: 'JefeNOC',
    groupSupervisor: 'IngenieriaCore',
    groupRestricted: 'InstaladoresExt',
    sampleFile1: 'captura_olt.pcap',
    sampleFile2: 'esquema_nodo.pdf',
    sampleSubfolder: 'Resueltas',
    sampleScript: 'provisionar_ont.bat',
    sampleLog: 'caidas_enlace.log',
  },
  {
    machine: 'SRV_AGRO',
    sector: 'Cooperativa Agrícola Sur',
    rootFolder: 'Campana',
    dropFolder: 'Tickets_Pesaje',
    enunciadoFolder: 'Precios_Lonja',
    archiveFolder: 'Liquidaciones',
    projectFolder: 'Exportacion_UE',
    logFolder: 'Riego_Parcelas',
    scriptFolder: 'Bascula_Serie',
    secretFolder: 'Acuerdos_Cadena',
    groupPrimary: 'Pesadores',
    groupLead: 'GerenteCoop',
    groupSupervisor: 'JuntaRectora',
    groupRestricted: 'Temporeros',
    sampleFile1: 'ticket_remolque.pdf',
    sampleFile2: 'calibre_naranja.xlsx',
    sampleSubfolder: 'Liquidadas',
    sampleScript: 'leer_bascula.exe',
    sampleLog: 'caudal_riego.log',
  },
  {
    machine: 'SRV_CIBER',
    sector: 'SOC CyberShield',
    rootFolder: 'Incidentes',
    dropFolder: 'Evidencias_Forenses',
    enunciadoFolder: 'Playbook_Actual',
    archiveFolder: 'Informes_SOC',
    projectFolder: 'Respuesta_APT',
    logFolder: 'Alertas_SIEM',
    scriptFolder: 'Triaje_Memoria',
    secretFolder: 'Credenciales_BreakGlass',
    groupPrimary: 'AnalistasSOC',
    groupLead: 'CISO',
    groupSupervisor: 'AuditoriaSeguridad',
    groupRestricted: 'BecariosSOC',
    sampleFile1: 'volcado_ram.bin',
    sampleFile2: 'ioc_list.csv',
    sampleSubfolder: 'Cerrados',
    sampleScript: 'extraer_hashes.exe',
    sampleLog: 'detecciones_edr.log',
  },
  {
    machine: 'SRV_ACADEMIA',
    sector: 'Academia Oposiciones Norte',
    rootFolder: 'Cursos',
    dropFolder: 'Simulacros_Subida',
    enunciadoFolder: 'Temario_Vigente',
    archiveFolder: 'Correcciones',
    projectFolder: 'Grupo_TAI',
    logFolder: 'Asistencia_Clases',
    scriptFolder: 'Corrector_Test',
    secretFolder: 'Becas_Privadas',
    groupPrimary: 'Opositores',
    groupLead: 'Preparador',
    groupSupervisor: 'DireccionAcademia',
    groupRestricted: 'InvitadosPrueba',
    sampleFile1: 'simulacro_04.pdf',
    sampleFile2: 'plantilla_resp.xlsx',
    sampleSubfolder: 'Corregidos',
    sampleScript: 'corregir_omr.exe',
    sampleLog: 'conexiones_aula.log',
  },
];

function makeBaseRoot(
  theme: DomainTheme,
  extraSubfolder: string
): VirtualFolderNode {
  return {
    id: 'root',
    name: theme.rootFolder,
    path: `C:\\${theme.rootFolder}`,
    parentId: null,
    owner: `${theme.machine}\\Administradores`,
    inheritanceEnabled: false,
    aces: [
      {
        id: 'r-adm',
        principalId: 'admin',
        type: 'allow',
        scope: 'this_folder_subfolders_files',
        permissions: [...FULL_PERMS],
        inheritedFrom: null,
      },
      {
        id: 'r-sys',
        principalId: 'system',
        type: 'allow',
        scope: 'this_folder_subfolders_files',
        permissions: [...FULL_PERMS],
        inheritedFrom: null,
      },
      {
        id: 'r-prim',
        principalId: 'primary',
        type: 'allow',
        scope: 'this_folder_only',
        permissions: [...RX_PERMS],
        inheritedFrom: null,
      },
      {
        id: 'r-lead',
        principalId: 'lead',
        type: 'allow',
        scope: 'this_folder_only',
        permissions: [...RX_PERMS],
        inheritedFrom: null,
      },
    ],
    share: {
      shared: false,
      shareName: theme.rootFolder,
      hidden: false,
      entries: [
        {
          id: 'sh-adm',
          principalId: 'admin',
          allow: ['read', 'change', 'full'],
          deny: [],
        },
      ],
    },
    sampleFiles: [],
    sampleSubfolders: [extraSubfolder],
  };
}

function makePrincipals(theme: DomainTheme) {
  return [
    {
      id: 'admin',
      name: 'Administradores',
      displayName: `${theme.machine}\\Administradores`,
      kind: 'system' as const,
    },
    {
      id: 'system',
      name: 'SYSTEM',
      displayName: 'SYSTEM',
      kind: 'system' as const,
    },
    {
      id: 'users',
      name: 'Usuarios',
      displayName: `${theme.machine}\\Usuarios`,
      kind: 'system' as const,
    },
    {
      id: 'auth_users',
      name: 'Usuarios autentificados',
      displayName: 'Usuarios autentificados',
      kind: 'system' as const,
    },
    {
      id: 'primary',
      name: theme.groupPrimary,
      displayName: `${theme.machine}\\${theme.groupPrimary}`,
      kind: 'group' as const,
      memberOf: ['users', 'auth_users'],
    },
    {
      id: 'lead',
      name: theme.groupLead,
      displayName: `${theme.machine}\\${theme.groupLead}`,
      kind: 'user' as const,
      memberOf: ['users', 'auth_users'],
    },
    {
      id: 'supervisor',
      name: theme.groupSupervisor,
      displayName: `${theme.machine}\\${theme.groupSupervisor}`,
      kind: 'group' as const,
      memberOf: ['users', 'auth_users'],
    },
    {
      id: 'restricted',
      name: theme.groupRestricted,
      displayName: `${theme.machine}\\${theme.groupRestricted}`,
      kind: 'group' as const,
      memberOf: ['primary', 'users', 'auth_users'],
      description: `Subgrupo dentro de ${theme.groupPrimary}`,
    },
  ];
}

type ArchetypeBuilder = (theme: DomainTheme, seqNum: number) => NtfsScenario;

const ARCHETYPES: ArchetypeBuilder[] = [
  // 1. Buzón de entrega ciega
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.dropFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Entrega de archivos en ${theme.dropFolder} (${theme.sector})`,
      category: 'Buzón de entrega ciega',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `El grupo «${theme.groupPrimary}» tiene que subir archivos desde sus ordenadores a ${targetPath}. Deben poder dejar su entrega ahí dentro, pero sin poder abrir la carpeta para curiosear qué han subido otros ni tocar o borrar los ficheros que ya estén guardados.`,
      contextNote: `Se conectan desde otros equipos de ${theme.sector}; ten en cuenta tanto el acceso por red como los permisos de la carpeta.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.dropFolder}), comparte la carpeta dando a ${theme.groupPrimary} «Cambiar» + «Leer». 2) En NTFS de ${theme.dropFolder}, aplica «Crear archivos / escribir datos» y «Permisos de lectura» en «Solo esta carpeta», sin «Mostrar carpeta / leer datos».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.dropFolder),
        {
          id: 'target',
          name: theme.dropFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'primary',
          folders,
          principals,
          issues,
          theme.groupPrimary
        );
        const onF = computeEffectivePermissions('target', 'primary', 'thisFolder', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals);
        if (onF.effective.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Entrega por red habilitada', detail: `${theme.groupPrimary} puede crear archivos nuevos desde otro equipo.` });
        } else if (hasShare && onF.local.has('createFilesWriteData')) {
          issues.push({ severity: 'error', title: 'Bloqueo en permisos de Red', detail: `NTFS permite entregar, pero en «Compartir (Red)» debes conceder «Cambiar» (y «Leer») a ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta creación de archivos', detail: 'Marca «Crear archivos / escribir datos» en «Solo esta carpeta».' });
        }
        if (!onF.effective.has('listRead') && !onFiles.effective.has('listRead') && !onF.local.has('listRead') && !onFiles.local.has('listRead')) {
          issues.push({ severity: 'success', title: 'Privacidad de buzón ciego', detail: 'No pueden listar contenido ni leer entregas previas.' });
        } else {
          issues.push({ severity: 'error', title: 'Pueden ver entregas ajenas', detail: 'Quita «Mostrar carpeta / leer datos» en NTFS.' });
        }
        if (onFiles.local.has('createFilesWriteData') || onFiles.local.has('delete') || onF.local.has('delete') || onF.local.has('deleteSubfoldersAndFiles')) {
          issues.push({ severity: 'error', title: 'Ámbito o borrado excesivo en NTFS', detail: 'Usa «Solo esta carpeta» y no concedas permisos de eliminación.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 2. Carpeta sin historial de subcarpetas
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.enunciadoFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Documentos vigentes en ${theme.enunciadoFolder} (${theme.sector})`,
      category: 'Carpetas sin historial',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'lead',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `«${theme.groupLead}» se conecta desde otro equipo a ${targetPath} para mantener al día los documentos vigentes. Necesita poder ver lo que hay, subir archivos nuevos, editarlos y borrarlos, pero sin crear subcarpetas de historial ni poder borrar la propia carpeta ${theme.enunciadoFolder}.`,
      contextNote: `Configúralo usando una única regla nueva para ${theme.groupLead} en la carpeta y habilitando su acceso en red.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.enunciadoFolder}), comparte para ${theme.groupLead} con «Cambiar» + «Leer». 2) En NTFS usa «Esta carpeta y archivos» con lectura, «Crear archivos / escribir datos», escribir atributos y «Eliminar subcarpetas y archivos» (sin «Crear carpetas / anexar datos» ni «Eliminar»).`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.enunciadoFolder),
        {
          id: 'target',
          name: theme.enunciadoFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-p', principalId: 'primary', type: 'allow', scope: 'this_folder_files', permissions: [...RX_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleFile2],
          sampleSubfolders: [],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'lead',
          folders,
          principals,
          issues,
          theme.groupLead
        );
        const onF = computeEffectivePermissions('target', 'lead', 'thisFolder', 'network', folders, principals);
        const onSub = computeEffectivePermissions('target', 'lead', 'subfolders', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'lead', 'files', 'network', folders, principals);
        if (onF.effective.has('listRead') && onF.effective.has('createFilesWriteData') && onFiles.effective.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Lectura, creación y edición de archivos por red', detail: `${theme.groupLead} puede gestionar los archivos actuales desde otro equipo.` });
        } else if (hasShare && onF.local.has('createFilesWriteData') && onFiles.local.has('createFilesWriteData')) {
          issues.push({ severity: 'error', title: 'Falta permiso «Cambiar» en Red', detail: `NTFS es correcto, pero en «Compartir (Red)» falta conceder «Cambiar» a ${theme.groupLead}.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura o gestión de archivos', detail: 'Aplica lectura y «Crear archivos / escribir datos» en «Esta carpeta y archivos».' });
        }
        if (onF.effective.has('createFoldersAppendData') || onF.local.has('createFoldersAppendData')) {
          issues.push({ severity: 'error', title: 'Puede crear subcarpetas', detail: 'Desmarca «Crear carpetas / anexar datos» en NTFS.' });
        } else {
          issues.push({ severity: 'success', title: 'Subcarpetas bloqueadas', detail: 'No podrá crear carpetas de historial.' });
        }
        if ((onF.effective.has('deleteSubfoldersAndFiles') || onFiles.effective.has('delete')) && !onF.effective.has('delete') && !onF.local.has('delete')) {
          issues.push({ severity: 'success', title: 'Puede borrar archivos sin borrar la carpeta', detail: 'La carpeta raíz queda protegida.' });
        } else {
          issues.push({ severity: 'error', title: 'Error en permisos de eliminación', detail: 'Marca «Eliminar subcarpetas y archivos» y quita «Eliminar» sobre la carpeta en NTFS (y asegura «Cambiar» en Red).' });
        }
        if (onSub.local.size > 0) {
          issues.push({ severity: 'error', title: 'Ámbito propagado a subcarpetas', detail: 'El ámbito correcto en NTFS es «Esta carpeta y archivos».' });
        }
        return buildEval(issues);
      },
    };
  },

  // 3. Romper herencia y aislar raíz
  (theme, seqNum) => {
    const rootPath = `C:\\${theme.rootFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Acceso a la raíz C:\\${theme.rootFolder} sin entrar en subcarpetas`,
      category: 'Herencia y aislamiento',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'root',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'security',
      enunciado: `En ${rootPath} está guardada la carpeta ${theme.projectFolder}. «${theme.groupPrimary}» va a conectarse desde otros puestos a ${rootPath}, pero solo debe poder ver qué carpetas cuelgan de ahí sin poder entrar en ${theme.projectFolder}. Además, limpia los grupos genéricos que vienen heredados del disco C:\\ para que no se cuele nadie más.`,
      contextNote: `Recuerda que se conectan por red desde otros ordenadores de ${theme.sector}.`,
      hint: `1) En Seguridad avanzada pulsa «Deshabilitar herencia» (Convertir), quita Usuarios y Usuarios autentificados, y añade a ${theme.groupPrimary} con Lectura y ejecución en «Solo esta carpeta». 2) En «Compartir (Red)» comparte ${rootPath} y concede «Leer» a ${theme.groupPrimary}.`,
      principals: makePrincipals(theme),
      initialFolders: [
        {
          id: 'disk',
          name: 'C:\\',
          path: 'C:\\',
          parentId: null,
          owner: 'SYSTEM',
          inheritanceEnabled: false,
          aces: [
            { id: 'd-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 'd-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 'd-usr', principalId: 'users', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...RX_PERMS], inheritedFrom: null },
            { id: 'd-auth', principalId: 'auth_users', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...MODIFY_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [],
          sampleSubfolders: [theme.rootFolder],
        },
        {
          id: 'root',
          name: theme.rootFolder,
          path: rootPath,
          parentId: 'disk',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: true,
          aces: [],
          share: {
            shared: false,
            shareName: theme.rootFolder,
            hidden: false,
            entries: [
              { id: 'sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
            ],
          },
          sampleFiles: [],
          sampleSubfolders: [theme.projectFolder],
        },
        {
          id: 'child',
          name: theme.projectFolder,
          path: `${rootPath}\\${theme.projectFolder}`,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: true,
          aces: [],
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const root = folders.find((f) => f.id === 'root')!;
        if (!root.inheritanceEnabled) {
          issues.push({ severity: 'success', title: 'Herencia deshabilitada', detail: `${rootPath} ya no hereda de C:\\.` });
        } else {
          issues.push({ severity: 'error', title: 'Herencia aún activa', detail: 'Debes deshabilitar la herencia en la carpeta raíz.' });
        }
        if (!root.aces.some((a) => a.principalId === 'users' || a.principalId === 'auth_users')) {
          issues.push({ severity: 'success', title: 'Grupos genéricos eliminados', detail: 'Usuarios y Usuarios autentificados han sido retirados.' });
        } else {
          issues.push({ severity: 'error', title: 'Permanecen Usuarios o Usuarios autentificados', detail: 'Quita ambos grupos de la ACL.' });
        }
        verifyNetworkShareAvailable('root', 'primary', folders, principals, issues, theme.groupPrimary);
        const onRoot = computeEffectivePermissions('root', 'primary', 'thisFolder', 'network', folders, principals);
        const onChild = computeEffectivePermissions('child', 'primary', 'thisFolder', 'network', folders, principals);
        if (onRoot.effective.has('listRead') && onRoot.effective.has('traverse') && !onRoot.effective.has('createFilesWriteData') && !onRoot.local.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Lectura en raíz por red correcta', detail: `${theme.groupPrimary} puede listar ${rootPath} desde otro equipo.` });
        } else {
          issues.push({ severity: 'error', title: `Falta lectura por red para ${theme.groupPrimary}`, detail: 'Concede Lectura y ejecución NTFS en «Solo esta carpeta» y «Leer» en «Compartir (Red)».' });
        }
        if (!onChild.effective.has('listRead') && !onChild.effective.has('traverse') && !onChild.local.has('listRead')) {
          issues.push({ severity: 'success', title: 'Subcarpeta aislada', detail: `${theme.projectFolder} no hereda acceso.` });
        } else {
          issues.push({ severity: 'error', title: `El permiso se propaga a ${theme.projectFolder}`, detail: 'Usa el ámbito «Solo esta carpeta» en NTFS.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 4. Supervisión global heredada
  (theme, seqNum) => {
    const rootPath = `C:\\${theme.rootFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Consulta global para ${theme.groupSupervisor} (${theme.sector})`,
      category: 'Herencia y aislamiento',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'root',
      targetPrincipalId: 'supervisor',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `Desde otros equipos de la red, «${theme.groupSupervisor}» necesita revisar todo lo que hay dentro de ${rootPath} y cualquier carpeta que exista o se cree en el futuro (como ${theme.projectFolder}). Solo es para consultar contenido y abrir archivos, sin posibilidad de crear, cambiar ni borrar nada.`,
      contextNote: `Lo que configures en ${rootPath} debe aplicarse también a todo lo que cuelgue por debajo.`,
      hint: `1) En «Compartir (Red)» de ${rootPath}, activa compartir y da «Leer» a ${theme.groupSupervisor}. 2) En NTFS añade a ${theme.groupSupervisor} con ámbito «Esta carpeta, subcarpetas y archivos» y Lectura y ejecución.`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder),
        {
          id: 'child',
          name: theme.projectFolder,
          path: `${rootPath}\\${theme.projectFolder}`,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: true,
          aces: [],
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [theme.sampleSubfolder],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        verifyNetworkShareAvailable('root', 'supervisor', folders, principals, issues, theme.groupSupervisor);
        const r = computeEffectivePermissions('root', 'supervisor', 'thisFolder', 'network', folders, principals);
        const c = computeEffectivePermissions('child', 'supervisor', 'files', 'network', folders, principals);
        if (r.effective.has('listRead') && r.effective.has('traverse') && c.effective.has('listRead') && c.effective.has('traverse')) {
          issues.push({ severity: 'success', title: 'Lectura por red propagada a toda la jerarquía', detail: `${theme.groupSupervisor} lee la raíz y las subcarpetas desde otro equipo.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta propagación o permiso de red', detail: 'Asegura «Leer» en «Compartir (Red)» y NTFS «Esta carpeta, subcarpetas y archivos» con Lectura y ejecución.' });
        }
        if (!r.effective.has('createFilesWriteData') && !c.effective.has('createFilesWriteData') && !r.local.has('createFilesWriteData') && !c.local.has('createFilesWriteData') && !r.local.has('delete') && !c.local.has('delete')) {
          issues.push({ severity: 'success', title: 'Solo lectura preservada', detail: 'Sin permisos de modificación ni borrado.' });
        } else {
          issues.push({ severity: 'error', title: 'Permisos de escritura o borrado detectados', detail: 'Retira cualquier permiso de creación, escritura o eliminación en NTFS.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 5. Permisos dobles: Modificar archivos existentes SIN crear nuevos ni borrar
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.projectFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Editar ficheros existentes sin crear ni borrar en ${theme.projectFolder}`,
      category: 'Permisos dobles',
      difficulty: 'Avanzado',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `«${theme.groupPrimary}» trabaja desde otros puestos conectados a ${targetPath}. Tienen que poder moverse por la carpeta y sus subcarpetas, leer los documentos y modificar el contenido de los archivos que ya existen; pero no pueden crear archivos nuevos, ni abrir subcarpetas nuevas, ni borrar nada.`,
      contextNote: `Acceden por red desde otros equipos. Fíjate en cómo cambian los permisos según se apliquen a carpetas o a archivos.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.projectFolder}), concede a ${theme.groupPrimary} «Cambiar» + «Leer». 2) En NTFS: Entrada 1 «Esta carpeta y subcarpetas» solo Lectura y ejecución. Entrada 2 «Solo archivos» con Lectura + «Crear archivos / escribir datos» (+ anexar/escribir atributos), sin «Eliminar».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder),
        {
          id: 'target',
          name: theme.projectFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleFile1, theme.sampleFile2],
          sampleSubfolders: [theme.sampleSubfolder],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'primary',
          folders,
          principals,
          issues,
          theme.groupPrimary
        );
        const onF = computeEffectivePermissions('target', 'primary', 'thisFolder', 'network', folders, principals);
        const onSub = computeEffectivePermissions('target', 'primary', 'subfolders', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals);
        if (onF.effective.has('listRead') && onSub.effective.has('listRead') && onFiles.effective.has('listRead')) {
          issues.push({ severity: 'success', title: 'Lectura completa por red', detail: 'Pueden explorar carpetas y abrir archivos desde otro equipo.' });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura en algún nivel', detail: 'Asegura «Compartir (Red)» y Lectura y ejecución NTFS en «Esta carpeta y subcarpetas» y «Solo archivos».' });
        }
        if (onFiles.effective.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Edición remota de archivos existentes activa', detail: 'Red (Cambiar) ∩ NTFS (Solo archivos: escribir datos) permite guardar modificaciones.' });
        } else if (hasShare && onFiles.local.has('createFilesWriteData')) {
          issues.push({ severity: 'error', title: 'Bloqueo en permisos de Red', detail: `NTFS permite editar archivos, pero en «Compartir (Red)» debes marcar «Cambiar» para ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: 'No pueden modificar archivos existentes', detail: 'Añade «Crear archivos / escribir datos» en NTFS con ámbito «Solo archivos».' });
        }
        if (onF.local.has('createFilesWriteData') || onSub.local.has('createFilesWriteData') || onF.local.has('createFoldersAppendData')) {
          issues.push({ severity: 'error', title: 'Pueden crear archivos o subcarpetas nuevos', detail: 'Quita permisos de creación en «Esta carpeta y subcarpetas».' });
        } else {
          issues.push({ severity: 'success', title: 'Creación bloqueada en carpetas', detail: 'No pueden crear nuevos archivos ni subcarpetas.' });
        }
        if (onFiles.local.has('delete') || onF.local.has('delete') || onF.local.has('deleteSubfoldersAndFiles')) {
          issues.push({ severity: 'error', title: 'Pueden eliminar archivos o carpetas', detail: 'Desmarca Eliminar y Eliminar subcarpetas y archivos en NTFS.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 6. Control del contenido sin borrar carpeta raíz
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.projectFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Administrar ${theme.projectFolder} sin poder borrarla (${theme.sector})`,
      category: 'Protección de carpeta raíz',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'lead',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `«${theme.groupLead}» gestiona ${targetPath} a distancia desde otro ordenador. Debe tener mano libre sobre todo lo que hay dentro —crear y borrar archivos o subcarpetas, cambiar permisos y hacerse propietario—, pero no puede eliminar ni cambiar el nombre de la propia carpeta ${theme.projectFolder}.`,
      contextNote: `Al trabajar a distancia por red, comprueba qué límite impone la forma de compartir frente a los permisos de seguridad.`,
      hint: `1) En «Compartir (Red)» (de C:\\${theme.rootFolder} o ${theme.projectFolder}) concede «Control total» a ${theme.groupLead}. 2) En NTFS selecciona «Esta carpeta, subcarpetas y archivos» y marca todos los permisos avanzados EXCEPTO «Control total» y «Eliminar».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder),
        {
          id: 'target',
          name: theme.projectFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [theme.sampleSubfolder],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'lead',
          folders,
          principals,
          issues,
          theme.groupLead
        );
        const onF = computeEffectivePermissions('target', 'lead', 'thisFolder', 'network', folders, principals);
        const onSub = computeEffectivePermissions('target', 'lead', 'subfolders', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'lead', 'files', 'network', folders, principals);
        if (!onF.local.has('delete') && !onF.local.has('fullControl') && !onF.effective.has('delete')) {
          issues.push({ severity: 'success', title: `Carpeta ${theme.projectFolder} protegida`, detail: 'No podrá eliminar ni renombrar la carpeta raíz.' });
        } else {
          issues.push({ severity: 'error', title: `Puede borrar ${theme.projectFolder}`, detail: 'En NTFS desmarca «Control total» y «Eliminar».' });
        }
        if (onF.effective.has('deleteSubfoldersAndFiles') && onF.effective.has('changePermissions') && onF.effective.has('takeOwnership') && onSub.effective.has('createFoldersAppendData') && onFiles.effective.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Administración remota completa del contenido', detail: 'Red (Control total) ∩ NTFS especial permite borrar contenido, cambiar permisos y tomar posesión por red.' });
        } else if (hasShare && onF.local.has('changePermissions') && onF.local.has('takeOwnership') && (!onF.effective.has('changePermissions') || !onF.effective.has('takeOwnership'))) {
          issues.push({ severity: 'error', title: 'Falta «Control total» en Compartir (Red)', detail: `NTFS ya incluye Cambiar permisos y Tomar posesión, pero el permiso de red «Cambiar» los bloquea. Marca «Control total» en Compartir (Red) para ${theme.groupLead}.` });
        } else {
          issues.push({ severity: 'error', title: 'Faltan permisos internos de administración', detail: 'Marca los 12 permisos NTFS restantes (incluidos Eliminar subcarpetas y archivos, Cambiar permisos y Tomar posesión) en «Esta carpeta, subcarpetas y archivos» y «Control total» en Red.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 7. Entrega en raíz y consulta de subcarpetas archivadas
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.archiveFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Subidas en raíz y consulta en ${theme.archiveFolder}`,
      category: 'Entrega y consulta',
      difficulty: 'Avanzado',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `«${theme.groupPrimary}» accede desde otros equipos a ${targetPath}. Ahí necesitan poder entrar, dejar archivos nuevos en la carpeta principal ${theme.archiveFolder} y leer los documentos que ${theme.groupLead} archive en subcarpetas como ${theme.sampleSubfolder}. No pueden modificar archivos ya subidos, ni borrar nada, ni crear subcarpetas.`,
      contextNote: `Ten en cuenta el acceso por red desde otros ordenadores y separa bien qué se permite en la raíz frente a las subcarpetas y archivos.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.archiveFolder}) da «Cambiar» + «Leer» a ${theme.groupPrimary}. 2) En NTFS: Entrada 1 «Solo esta carpeta» con Lectura y ejecución + «Crear archivos / escribir datos». Entrada 2 «Esta carpeta, subcarpetas y archivos» con solo Lectura y ejecución.`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.archiveFolder),
        {
          id: 'target',
          name: theme.archiveFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [theme.sampleSubfolder],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'primary',
          folders,
          principals,
          issues,
          theme.groupPrimary
        );
        const onF = computeEffectivePermissions('target', 'primary', 'thisFolder', 'network', folders, principals);
        const onSub = computeEffectivePermissions('target', 'primary', 'subfolders', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals);
        if (onF.effective.has('createFilesWriteData') && onF.effective.has('listRead')) {
          issues.push({ severity: 'success', title: 'Subida en la raíz por red permitida', detail: 'Pueden listar la carpeta y crear archivos nuevos en la raíz desde otro equipo.' });
        } else if (hasShare && onF.local.has('createFilesWriteData') && onF.local.has('listRead')) {
          issues.push({ severity: 'error', title: 'Falta permiso «Cambiar» en Red', detail: `NTFS permite entregar en raíz, pero en «Compartir (Red)» falta «Cambiar» para ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: 'No pueden entregar en la raíz', detail: 'Añade Lectura + «Crear archivos / escribir datos» en NTFS («Solo esta carpeta»).' });
        }
        if (onSub.effective.has('listRead') && onFiles.effective.has('listRead')) {
          issues.push({ severity: 'success', title: 'Consulta en subcarpetas activa', detail: `Pueden leer archivos en ${theme.sampleSubfolder}.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura en subcarpetas', detail: 'Añade Lectura y ejecución en «Esta carpeta, subcarpetas y archivos».' });
        }
        if (onFiles.local.has('createFilesWriteData') || onSub.local.has('createFilesWriteData') || onF.local.has('createFoldersAppendData') || onFiles.local.has('delete')) {
          issues.push({ severity: 'error', title: 'Permisos excesivos de escritura o borrado en NTFS', detail: 'No concedas escritura sobre archivos ni creación de subcarpetas ni Eliminar.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 8. Intersección Red + NTFS con recurso oculto ($) a Leer
  (theme, seqNum) => {
    const shareTarget = `${theme.secretFolder}$`;
    const targetPath = `C:\\${theme.rootFolder}\\${theme.secretFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Carpeta oculta ${shareTarget} en red (${theme.sector})`,
      category: 'Intersección Red y NTFS',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'supervisor',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `La carpeta ${targetPath} debe publicarse en red de manera oculta usando el nombre «${shareTarget}». Aunque en el propio equipo «${theme.groupSupervisor}» puede editar y borrar archivos ahí dentro, cuando se conecte desde otro ordenador por red solo debe poder consultar el contenido sin cambiar ni eliminar nada.`,
      contextNote: `Mantén intactos los permisos locales actuales y resuélvelo desde la configuración de red.`,
      hint: `En «Compartir (Red)», activa compartir con nombre «${shareTarget}» y agrega a ${theme.groupSupervisor} marcando únicamente «Leer».`,
      principals: makePrincipals(theme),
      initialFolders: [
        {
          id: 'target',
          name: theme.secretFolder,
          path: targetPath,
          parentId: null,
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sup', principalId: 'supervisor', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...MODIFY_PERMS], inheritedFrom: null },
          ],
          share: {
            shared: false,
            shareName: theme.secretFolder,
            hidden: false,
            entries: [{ id: 'sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] }],
          },
          sampleFiles: [theme.sampleFile2],
          sampleSubfolders: [],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const node = folders.find((f) => f.id === 'target')!;
        if (node.share?.shared && node.share.shareName.trim().toLowerCase() === shareTarget.toLowerCase()) {
          issues.push({ severity: 'success', title: `Recurso oculto ${shareTarget}`, detail: 'Compartido correctamente con el símbolo $ al final.' });
        } else {
          issues.push({ severity: 'error', title: 'Nombre o estado de compartido incorrecto', detail: `Activa compartir con el nombre exacto «${shareTarget}».` });
        }
        const net = computeEffectivePermissions('target', 'supervisor', 'files', 'network', folders, principals);
        if (net.local.has('createFilesWriteData') && net.local.has('delete')) {
          issues.push({ severity: 'success', title: 'NTFS local intacto', detail: 'Se conserva el permiso local Modificar.' });
        } else {
          issues.push({ severity: 'error', title: 'Se alteró el permiso local NTFS', detail: 'Mantén Modificar en NTFS y restringe mediante el permiso de Red.' });
        }
        if (net.effective.has('listRead') && !net.effective.has('createFilesWriteData') && !net.effective.has('delete')) {
          issues.push({ severity: 'success', title: 'Intersección Red ∩ NTFS correcta', detail: 'Acceso remoto efectivo limitado a solo lectura.' });
        } else {
          issues.push({ severity: 'error', title: 'Permiso efectivo en red excesivo', detail: 'Marca únicamente «Leer» en los permisos del recurso compartido.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 9. Intersección Red Cambiar vs NTFS Control total (impedir cambiar permisos por red)
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.projectFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Acceso remoto limitado en ${theme.projectFolder}`,
      category: 'Intersección Red y NTFS',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'lead',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `En local, «${theme.groupLead}» manda por completo sobre ${targetPath}. Sin embargo, cuando se conecte desde otro equipo al recurso compartido «${theme.projectFolder}», queremos que pueda leer, añadir, editar y borrar contenido, pero sin poder tocar los permisos ni cambiar el propietario a distancia.`,
      contextNote: `No modifiques los permisos locales que ya tiene; controla el límite desde el acceso compartido en red.`,
      hint: `Comparte ${theme.projectFolder} y asigna a ${theme.groupLead} permiso de red «Cambiar» (y «Leer»), dejando desmarcado «Control total» en Red.`,
      principals: makePrincipals(theme),
      initialFolders: [
        {
          id: 'target',
          name: theme.projectFolder,
          path: targetPath,
          parentId: null,
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-lead', principalId: 'lead', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          share: {
            shared: false,
            shareName: theme.projectFolder,
            hidden: false,
            entries: [{ id: 'sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] }],
          },
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [theme.sampleSubfolder],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const node = folders.find((f) => f.id === 'target')!;
        if (node.share?.shared && node.share.shareName.trim().toLowerCase() === theme.projectFolder.toLowerCase()) {
          issues.push({ severity: 'success', title: 'Carpeta compartida en red', detail: `Recurso \\\\${theme.machine}\\${node.share.shareName} activo.` });
        } else {
          issues.push({ severity: 'error', title: 'Recurso no compartido correctamente', detail: `Comparte la carpeta con el nombre «${theme.projectFolder}».` });
        }
        const net = computeEffectivePermissions('target', 'lead', 'files', 'network', folders, principals);
        if (net.local.has('changePermissions') && net.local.has('takeOwnership')) {
          issues.push({ severity: 'success', title: 'NTFS local intacto', detail: 'Se conserva el Control total en local.' });
        } else {
          issues.push({ severity: 'error', title: 'Se alteró el permiso local NTFS', detail: `Mantén el Control total local de ${theme.groupLead} y aplica la restricción únicamente en Compartir (Red).` });
        }
        if (net.effective.has('createFilesWriteData') && net.effective.has('delete') && !net.effective.has('changePermissions') && !net.effective.has('takeOwnership')) {
          issues.push({ severity: 'success', title: 'Intersección Red (Cambiar) ∩ NTFS (Control total)', detail: 'Puede trabajar por red pero sin administrar permisos ni tomar posesión remotamente.' });
        } else {
          issues.push({ severity: 'error', title: 'Permiso de red incorrecto para ' + theme.groupLead, detail: 'Asigna en Compartir los permisos «Cambiar» y «Leer», sin marcar «Control total».' });
        }
        return buildEval(issues);
      },
    };
  },

  // 10. Segundo permiso doble: Anexar datos al final de registros (logs) sin sobrescribir ni borrar
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.logFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Añadir líneas al final de los logs en ${theme.logFolder} (${theme.sector})`,
      category: 'Permisos dobles',
      difficulty: 'Avanzado',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `En ${targetPath} se guardan ficheros de registro como ${theme.sampleLog}. «${theme.groupPrimary}» se conecta por red desde otro equipo y tiene que poder entrar, leer los registros y añadir nuevas líneas al final de los archivos que ya hay; pero sin poder machacar lo que ya estaba escrito, ni crear archivos o subcarpetas nuevos, ni borrar nada.`,
      contextNote: `Combina el acceso por red con los permisos adecuados según afecten a la carpeta o a los archivos.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.logFolder}), concede «Cambiar» + «Leer» a ${theme.groupPrimary}. 2) En NTFS: Entrada 1 «Solo esta carpeta» con Lectura y ejecución. Entrada 2 «Solo archivos» con Lectura + «Crear carpetas / anexar datos», SIN «Crear archivos / escribir datos» ni «Eliminar».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.logFolder),
        {
          id: 'target',
          name: theme.logFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleLog],
          sampleSubfolders: [],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'primary',
          folders,
          principals,
          issues,
          theme.groupPrimary
        );
        const onF = computeEffectivePermissions('target', 'primary', 'thisFolder', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals);
        if (onF.effective.has('listRead') && onFiles.effective.has('listRead')) {
          issues.push({ severity: 'success', title: 'Lectura por red de carpeta y ficheros log', detail: 'Pueden abrir y consultar el archivo de registro desde otro equipo.' });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura', detail: 'Concede Lectura y ejecución NTFS tanto en la carpeta como en los archivos y permiso «Leer» en Red.' });
        }
        if (onFiles.effective.has('createFoldersAppendData') && !onFiles.effective.has('createFilesWriteData') && !onFiles.local.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Anexar datos sin sobrescritura por red', detail: 'Red (Cambiar) ∩ NTFS (Solo archivos: Anexar datos) permite añadir líneas al final sin sobrescribir el historial.' });
        } else if (hasShare && onFiles.local.has('createFoldersAppendData') && !onFiles.local.has('createFilesWriteData')) {
          issues.push({ severity: 'error', title: 'Falta permiso «Cambiar» en Red', detail: `NTFS permite anexar datos, pero en «Compartir (Red)» debes conceder «Cambiar» a ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: 'Configuración de anexado incorrecta', detail: 'En «Solo archivos», marca «Crear carpetas / anexar datos» y deja desmarcado «Crear archivos / escribir datos».' });
        }
        if (onF.local.has('createFilesWriteData') || onF.local.has('createFoldersAppendData') || onFiles.local.has('delete') || onF.local.has('delete')) {
          issues.push({ severity: 'error', title: 'Permisos excesivos de creación o borrado en NTFS', detail: 'No concedas creación de archivos/carpetas en la carpeta ni permisos Eliminar.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 11. Solo ejecución de scripts/programas sin poder leer ni copiar
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.scriptFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Ejecutar programas sin ver la carpeta ${theme.scriptFolder}`,
      category: 'Ejecución y Denegar',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `En ${targetPath} está guardado el programa ${theme.sampleScript}. «${theme.groupPrimary}» se conecta desde otro equipo y necesita poder ejecutar esa herramienta sabiendo su ruta, pero sin poder listar qué archivos hay en la carpeta, ni abrir o copiar el contenido del fichero, ni tocar nada.`,
      contextNote: `Piensa en la diferencia entre poder lanzar un ejecutable y poder leerlo o ver el listado de la carpeta.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.scriptFolder}), concede «Leer» a ${theme.groupPrimary}. 2) En NTFS aplica a «Esta carpeta y archivos» únicamente «Atravesar carpeta / ejecutar archivo» + lectura de atributos/permisos, SIN «Mostrar carpeta / leer datos».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.scriptFolder),
        {
          id: 'target',
          name: theme.scriptFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleScript],
          sampleSubfolders: [],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        verifyNetworkShareAvailable(
          'target',
          'primary',
          folders,
          principals,
          issues,
          theme.groupPrimary
        );
        const onF = computeEffectivePermissions('target', 'primary', 'thisFolder', 'network', folders, principals);
        const onFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals);
        if (onF.effective.has('traverse') && onFiles.effective.has('traverse')) {
          issues.push({ severity: 'success', title: 'Atravesar y ejecutar por red habilitado', detail: `Pueden ejecutar ${theme.sampleScript} por red conociendo su ruta.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta ejecución o recurso compartido', detail: 'Marca «Atravesar carpeta / ejecutar archivo» en NTFS («Esta carpeta y archivos») y «Leer» en «Compartir (Red)».' });
        }
        if (!onF.effective.has('listRead') && !onFiles.effective.has('listRead') && !onF.local.has('listRead') && !onFiles.local.has('listRead')) {
          issues.push({ severity: 'success', title: 'Lectura y copiado bloqueados', detail: 'Sin «Mostrar carpeta / leer datos» en NTFS, no pueden listar ni leer el archivo.' });
        } else {
          issues.push({ severity: 'error', title: 'Pueden listar o leer el programa', detail: 'Desmarca «Mostrar carpeta / leer datos» en NTFS.' });
        }
        if (onF.local.has('createFilesWriteData') || onFiles.local.has('createFilesWriteData') || onFiles.local.has('delete')) {
          issues.push({ severity: 'error', title: 'Permisos de escritura o borrado activos en NTFS', detail: 'Retira cualquier permiso de modificación o eliminación.' });
        }
        return buildEval(issues);
      },
    };
  },

  // 12. Denegar explícito (Denegar prevalece sobre Permitir de grupo padre)
  (theme, seqNum) => {
    const targetPath = `C:\\${theme.rootFolder}\\${theme.projectFolder}`;
    return {
      id: `bank-${seqNum}`,
      number: seqNum,
      title: `Restricción para ${theme.groupRestricted} en ${theme.projectFolder} (${theme.sector})`,
      category: 'Ejecución y Denegar',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'restricted',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `«${theme.groupPrimary}» se conecta desde otros equipos a ${targetPath}, donde ya puede leer, editar y borrar contenido. Sin embargo, los miembros del subgrupo «${theme.groupRestricted}» (que pertenecen a ${theme.groupPrimary}) solo deben poder leer cuando entren por red, teniendo bloqueado crear, modificar o eliminar nada.`,
      contextNote: `No quites el acceso al grupo principal ${theme.groupPrimary}; añade la restricción para ${theme.groupRestricted} y habilita el acceso en red.`,
      hint: `1) En «Compartir (Red)» (en C:\\${theme.rootFolder} o ${theme.projectFolder}) concede «Cambiar» + «Leer» a ${theme.groupPrimary}. 2) En NTFS conserva a ${theme.groupPrimary} y añade una entrada «Denegar» para ${theme.groupRestricted} en «Esta carpeta, subcarpetas y archivos» marcando escritura, creación y eliminación.`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder),
        {
          id: 'target',
          name: theme.projectFolder,
          path: targetPath,
          parentId: 'root',
          owner: `${theme.machine}\\Administradores`,
          inheritanceEnabled: false,
          aces: [
            { id: 't-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
            { id: 't-prim', principalId: 'primary', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...MODIFY_PERMS], inheritedFrom: null },
          ],
          sampleFiles: [theme.sampleFile1],
          sampleSubfolders: [theme.sampleSubfolder],
        },
      ],
      checkSolution: (folders, principals) => {
        const issues: EvaluationIssue[] = [];
        const hasShare = verifyNetworkShareAvailable(
          'target',
          'primary',
          folders,
          principals,
          issues,
          theme.groupPrimary
        );
        const pFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals);
        const rFolder = computeEffectivePermissions('target', 'restricted', 'thisFolder', 'network', folders, principals);
        const rFiles = computeEffectivePermissions('target', 'restricted', 'files', 'network', folders, principals);

        if (pFiles.effective.has('createFilesWriteData') && pFiles.effective.has('delete')) {
          issues.push({ severity: 'success', title: `Acceso por red de ${theme.groupPrimary} conservado`, detail: 'El resto de miembros mantiene Modificar desde otro equipo.' });
        } else if (hasShare && pFiles.local.has('createFilesWriteData') && pFiles.local.has('delete')) {
          issues.push({ severity: 'error', title: `Falta «Cambiar» en Red para ${theme.groupPrimary}`, detail: `En «Compartir (Red)» asigna «Cambiar» y «Leer» a ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: `Se modificó el acceso de ${theme.groupPrimary}`, detail: `Conserva la entrada NTFS Permitir Modificar de ${theme.groupPrimary}.` });
        }

        if (rFolder.effective.has('traverse') && rFolder.effective.has('listRead') && rFiles.effective.has('listRead')) {
          issues.push({ severity: 'success', title: `Lectura por red preservada para ${theme.groupRestricted}`, detail: 'Pueden seguir entrando y leyendo la carpeta y archivos.' });
        } else {
          issues.push({ severity: 'error', title: `Se bloqueó también la lectura de ${theme.groupRestricted}`, detail: 'No marques Control total ni permisos de lectura o atravesar en la regla Denegar.' });
        }

        if (!rFolder.local.has('createFilesWriteData') && !rFiles.local.has('createFilesWriteData') && !rFolder.local.has('createFoldersAppendData') && !rFiles.local.has('delete') && !rFolder.effective.has('createFilesWriteData') && !rFiles.effective.has('delete')) {
          issues.push({ severity: 'success', title: 'Escritura y eliminación denegadas en NTFS', detail: `Denegar en NTFS anula los permisos heredados de ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: `${theme.groupRestricted} todavía puede escribir o borrar`, detail: `Añade una entrada NTFS «Denegar» para ${theme.groupRestricted} en «Esta carpeta, subcarpetas y archivos» bloqueando escritura, creación y eliminación.` });
        }
        return buildEval(issues);
      },
    };
  },
];

export const ALL_SCENARIOS: NtfsScenario[] = (() => {
  const generated: NtfsScenario[] = [];
  let seq = NTFS_SCENARIOS.length + 1;
  for (const theme of DOMAIN_THEMES) {
    for (const builder of ARCHETYPES) {
      generated.push(builder(theme, seq));
      seq += 1;
    }
  }
  return [...NTFS_SCENARIOS, ...generated];
})();

export function drawRandomExam(
  bank: NtfsScenario[],
  count = 10
): NtfsScenario[] {
  const byCategory = new Map<ScenarioCategory, NtfsScenario[]>();
  for (const sc of bank) {
    const arr = byCategory.get(sc.category) ?? [];
    arr.push(sc);
    byCategory.set(sc.category, arr);
  }

  const categories = Array.from(byCategory.keys());
  const picked: NtfsScenario[] = [];
  const usedIds = new Set<string>();

  // First pass: shuffle categories and pick 1 from each category for broad coverage
  const shuffledCats = [...categories].sort(() => Math.random() - 0.5);
  for (const cat of shuffledCats) {
    if (picked.length >= count) break;
    const pool = byCategory.get(cat)!;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!usedIds.has(chosen.id)) {
      usedIds.add(chosen.id);
      picked.push(chosen);
    }
  }

  // Second pass: fill remaining slots randomly from entire bank
  const shuffledBank = [...bank].sort(() => Math.random() - 0.5);
  for (const sc of shuffledBank) {
    if (picked.length >= count) break;
    if (!usedIds.has(sc.id)) {
      usedIds.add(sc.id);
      picked.push(sc);
    }
  }

  // Shuffle final order of the 10 questions
  return picked.sort(() => Math.random() - 0.5);
}
