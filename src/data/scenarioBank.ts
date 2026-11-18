import {
  EvaluationIssue,
  NtfsScenario,
  ScenarioCategory,
  ScenarioEvaluation,
  VirtualFolderNode,
} from '../types/ntfs';
import {
  computeEffectivePermissions,
  computeLocalEffectivePermissions,
} from '../utils/ntfsEngine';
import { NTFS_SCENARIOS } from './scenarios';

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
  extraSubfolder: string,
  shared = true,
  shareAllowChange = true
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
    ],
    share: shared
      ? {
          shared: true,
          shareName: theme.rootFolder,
          hidden: false,
          entries: [
            {
              id: 'sh-adm',
              principalId: 'admin',
              allow: ['read', 'change', 'full'],
              deny: [],
            },
            {
              id: 'sh-prim',
              principalId: 'primary',
              allow: shareAllowChange ? ['read', 'change'] : ['read'],
              deny: [],
            },
          ],
        }
      : undefined,
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
      title: `Buzón ciego en ${theme.dropFolder} (${theme.sector})`,
      category: 'Buzón de entrega ciega',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'network',
      focusTab: 'entry',
      enunciado: `En ${targetPath}, configura los permisos NTFS para «${theme.groupPrimary}» de modo que puedan depositar archivos nuevos en la carpeta, pero NO puedan abrirla para listar las entregas de otros compañeros ni leer, modificar o eliminar archivos ya existentes.`,
      contextNote: `La carpeta padre C:\\${theme.rootFolder} está compartida en red con permiso Cambiar y Leer para ${theme.groupPrimary}.`,
      hint: `Aplica «Crear archivos / escribir datos» y «Permisos de lectura» en «Solo esta carpeta», dejando desmarcado «Mostrar carpeta / leer datos».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.dropFolder, true, true),
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
        const onF = computeEffectivePermissions('target', 'primary', 'thisFolder', 'network', folders, principals).effective;
        const onFiles = computeEffectivePermissions('target', 'primary', 'files', 'network', folders, principals).effective;
        if (onF.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Entrega habilitada', detail: `${theme.groupPrimary} puede crear archivos nuevos en la carpeta.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta creación de archivos', detail: 'Marca «Crear archivos / escribir datos» en «Solo esta carpeta».' });
        }
        if (!onF.has('listRead') && !onFiles.has('listRead')) {
          issues.push({ severity: 'success', title: 'Privacidad de buzón ciego', detail: 'No pueden listar contenido ni leer entregas previas.' });
        } else {
          issues.push({ severity: 'error', title: 'Pueden ver entregas ajenas', detail: 'Quita «Mostrar carpeta / leer datos».' });
        }
        if (onFiles.has('createFilesWriteData') || onFiles.has('delete') || onF.has('delete') || onF.has('deleteSubfoldersAndFiles')) {
          issues.push({ severity: 'error', title: 'Ámbito o borrado excesivo', detail: 'Usa «Solo esta carpeta» y no concedas permisos de eliminación.' });
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
      title: `Gestión sin subcarpetas en ${theme.enunciadoFolder} (${theme.sector})`,
      category: 'Carpetas sin historial',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'lead',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath}, «${theme.groupLead}» solo debe mantener el documento vigente sin crear subcarpetas de historial. Configura UNA entrada para que pueda listar la carpeta, crear, modificar y eliminar archivos, pero NO crear subcarpetas ni borrar la carpeta ${theme.enunciadoFolder}.`,
      contextNote: `Este patrón evita que se acumulen subcarpetas antiguas dentro de una carpeta de publicación directa.`,
      hint: `Usa el ámbito «Esta carpeta y archivos» con lectura, «Crear archivos / escribir datos», escribir atributos y «Eliminar subcarpetas y archivos» (sin «Crear carpetas / anexar datos» ni «Eliminar»).`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.enunciadoFolder, false, false),
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
        const onF = computeLocalEffectivePermissions('target', 'lead', 'thisFolder', folders, principals);
        const onSub = computeLocalEffectivePermissions('target', 'lead', 'subfolders', folders, principals);
        const onFiles = computeLocalEffectivePermissions('target', 'lead', 'files', folders, principals);
        if (onF.has('listRead') && onF.has('createFilesWriteData') && onFiles.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Lectura, creación y edición de archivos', detail: `${theme.groupLead} puede gestionar los archivos actuales.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura o gestión de archivos', detail: 'Aplica lectura y «Crear archivos / escribir datos» en «Esta carpeta y archivos».' });
        }
        if (onF.has('createFoldersAppendData')) {
          issues.push({ severity: 'error', title: 'Puede crear subcarpetas', detail: 'Desmarca «Crear carpetas / anexar datos».' });
        } else {
          issues.push({ severity: 'success', title: 'Subcarpetas bloqueadas', detail: 'No podrá crear carpetas de historial.' });
        }
        if ((onF.has('deleteSubfoldersAndFiles') || onFiles.has('delete')) && !onF.has('delete')) {
          issues.push({ severity: 'success', title: 'Puede borrar archivos sin borrar la carpeta', detail: 'La carpeta raíz queda protegida.' });
        } else {
          issues.push({ severity: 'error', title: 'Error en permisos de eliminación', detail: 'Marca «Eliminar subcarpetas y archivos» y quita «Eliminar» sobre la carpeta.' });
        }
        if (onSub.size > 0) {
          issues.push({ severity: 'error', title: 'Ámbito propagado a subcarpetas', detail: 'El ámbito correcto es «Esta carpeta y archivos».' });
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
      title: `Romper herencia y aislar raíz C:\\${theme.rootFolder}`,
      category: 'Herencia y aislamiento',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'root',
      targetPrincipalId: 'primary',
      testAccessMode: 'local',
      focusTab: 'security',
      enunciado: `En ${rootPath} cuelga la subcarpeta ${theme.projectFolder}. Debes: 1) Deshabilitar la herencia de ${rootPath} y eliminar los grupos «Usuarios» y «Usuarios autentificados», y 2) Conceder a «${theme.groupPrimary}» Lectura y ejecución SOLO en ${rootPath}, sin que se herede hacia ${theme.projectFolder}.`,
      contextNote: `De este modo ningún usuario no autorizado entra en subcarpetas de proyecto por herencia del disco C:\\.`,
      hint: `En Seguridad avanzada pulsa «Deshabilitar herencia» (Convertir), quita Usuarios y Usuarios autentificados, y añade a ${theme.groupPrimary} con Lectura y ejecución en «Solo esta carpeta».`,
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
        const onRoot = computeLocalEffectivePermissions('root', 'primary', 'thisFolder', folders, principals);
        const onChild = computeLocalEffectivePermissions('child', 'primary', 'thisFolder', folders, principals);
        if (onRoot.has('listRead') && onRoot.has('traverse') && !onRoot.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Lectura en raíz correcta', detail: `${theme.groupPrimary} puede listar ${rootPath}.` });
        } else {
          issues.push({ severity: 'error', title: `Falta lectura para ${theme.groupPrimary}`, detail: 'Concede Lectura y ejecución sin escritura.' });
        }
        if (!onChild.has('listRead') && !onChild.has('traverse')) {
          issues.push({ severity: 'success', title: 'Subcarpeta aislada', detail: `${theme.projectFolder} no hereda acceso.` });
        } else {
          issues.push({ severity: 'error', title: `El permiso se propaga a ${theme.projectFolder}`, detail: 'Usa el ámbito «Solo esta carpeta».' });
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
      title: `Supervisión solo lectura de ${theme.groupSupervisor} (${theme.sector})`,
      category: 'Herencia y aislamiento',
      difficulty: 'Básico',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'root',
      targetPrincipalId: 'supervisor',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${rootPath}, configura una entrada para «${theme.groupSupervisor}» de modo que pueda leer y ejecutar absolutamente todo el contenido de ${rootPath} y de cualquier proyecto actual o futuro (como ${theme.projectFolder}), sin poder crear, editar ni borrar nada.`,
      contextNote: `Al configurarlo en la carpeta padre con propagación total, cualquier nueva subcarpeta heredará el permiso.`,
      hint: `Añade a ${theme.groupSupervisor} con ámbito «Esta carpeta, subcarpetas y archivos» y permisos de Lectura y ejecución.`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder, false, false),
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
        const r = computeLocalEffectivePermissions('root', 'supervisor', 'thisFolder', folders, principals);
        const c = computeLocalEffectivePermissions('child', 'supervisor', 'files', folders, principals);
        if (r.has('listRead') && r.has('traverse') && c.has('listRead') && c.has('traverse')) {
          issues.push({ severity: 'success', title: 'Lectura propagada a toda la jerarquía', detail: `${theme.groupSupervisor} lee la raíz y las subcarpetas.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta propagación completa', detail: 'Usa «Esta carpeta, subcarpetas y archivos» con Lectura y ejecución.' });
        }
        if (!r.has('createFilesWriteData') && !c.has('createFilesWriteData') && !r.has('delete') && !c.has('delete')) {
          issues.push({ severity: 'success', title: 'Solo lectura preservada', detail: 'Sin permisos de modificación ni borrado.' });
        } else {
          issues.push({ severity: 'error', title: 'Permisos de escritura o borrado detectados', detail: 'Retira cualquier permiso de creación, escritura o eliminación.' });
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
      title: `Editar archivos existentes sin crear ni borrar en ${theme.projectFolder}`,
      category: 'Permisos dobles',
      difficulty: 'Avanzado',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath}, el grupo «${theme.groupPrimary}» debe poder navegar por la carpeta y sus subcarpetas, leer todo y MODIFICAR el contenido de los archivos ya existentes. Sin embargo, NO debe poder crear archivos nuevos, NO debe crear subcarpetas y NO debe borrar ni archivos ni carpetas.`,
      contextNote: `Requiere separar ámbitos en dos entradas de permiso para aprovechar los permisos dobles de NTFS.`,
      hint: `Entrada 1: «Esta carpeta y subcarpetas» solo Lectura y ejecución. Entrada 2: «Solo archivos» con Lectura + «Crear archivos / escribir datos» (+ «Crear carpetas / anexar datos» y escribir atributos), sin «Eliminar».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder, false, false),
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
        const onF = computeLocalEffectivePermissions('target', 'primary', 'thisFolder', folders, principals);
        const onSub = computeLocalEffectivePermissions('target', 'primary', 'subfolders', folders, principals);
        const onFiles = computeLocalEffectivePermissions('target', 'primary', 'files', folders, principals);
        if (onF.has('listRead') && onSub.has('listRead') && onFiles.has('listRead')) {
          issues.push({ severity: 'success', title: 'Lectura completa en carpeta, subcarpetas y archivos', detail: 'Pueden explorar y abrir archivos.' });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura en algún nivel', detail: 'Asegura Lectura y ejecución en «Esta carpeta y subcarpetas» y en «Solo archivos».' });
        }
        if (onFiles.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Edición de archivos existentes activa', detail: 'En «Solo archivos», Crear archivos/escribir datos permite sobrescribir datos.' });
        } else {
          issues.push({ severity: 'error', title: 'No pueden modificar archivos existentes', detail: 'Añade «Crear archivos / escribir datos» en «Solo archivos».' });
        }
        if (onF.has('createFilesWriteData') || onSub.has('createFilesWriteData') || onF.has('createFoldersAppendData')) {
          issues.push({ severity: 'error', title: 'Pueden crear archivos o subcarpetas nuevos', detail: 'Quita permisos de creación en «Esta carpeta y subcarpetas».' });
        } else {
          issues.push({ severity: 'success', title: 'Creación bloqueada en carpetas', detail: 'No pueden crear nuevos archivos ni subcarpetas.' });
        }
        if (onFiles.has('delete') || onF.has('delete') || onF.has('deleteSubfoldersAndFiles')) {
          issues.push({ severity: 'error', title: 'Pueden eliminar archivos o carpetas', detail: 'Desmarca Eliminar y Eliminar subcarpetas y archivos.' });
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
      title: `Control de contenido sin borrar ${theme.projectFolder} (${theme.sector})`,
      category: 'Protección de carpeta raíz',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'lead',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath}, «${theme.groupLead}» debe administrar por completo todo el contenido interno (crear y eliminar subcarpetas y archivos, modificar permisos y tomar posesión), pero NO debe poder eliminar ni renombrar la propia carpeta ${theme.projectFolder}.`,
      contextNote: `Marcar «Control total» habilitaría también el borrado de la carpeta raíz; es necesario configurar un permiso Especial.`,
      hint: `Selecciona «Esta carpeta, subcarpetas y archivos» y marca todos los permisos avanzados EXCEPTO «Control total» y «Eliminar».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder, false, false),
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
        const onF = computeLocalEffectivePermissions('target', 'lead', 'thisFolder', folders, principals);
        const onSub = computeLocalEffectivePermissions('target', 'lead', 'subfolders', folders, principals);
        const onFiles = computeLocalEffectivePermissions('target', 'lead', 'files', folders, principals);
        if (!onF.has('delete') && !onF.has('fullControl')) {
          issues.push({ severity: 'success', title: `Carpeta ${theme.projectFolder} protegida`, detail: 'No podrá eliminar ni renombrar la carpeta raíz.' });
        } else {
          issues.push({ severity: 'error', title: `Puede borrar ${theme.projectFolder}`, detail: 'Desmarca «Control total» y «Eliminar».' });
        }
        if (onF.has('deleteSubfoldersAndFiles') && onF.has('changePermissions') && onF.has('takeOwnership') && onSub.has('createFoldersAppendData') && onFiles.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Administración completa del contenido', detail: 'Incluye borrar contenido interno, cambiar permisos y tomar posesión.' });
        } else {
          issues.push({ severity: 'error', title: 'Faltan permisos internos de administración', detail: 'Marca los 12 permisos restantes (incluidos Eliminar subcarpetas y archivos, Cambiar permisos y Tomar posesión) en «Esta carpeta, subcarpetas y archivos».' });
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
      title: `Entrega en raíz y consulta de archivo en ${theme.archiveFolder}`,
      category: 'Entrega y consulta',
      difficulty: 'Avanzado',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath}, «${theme.groupPrimary}» debe poder ver la carpeta y subir archivos nuevos en la raíz ${theme.archiveFolder}, y además leer los elementos que ${theme.groupLead} archive en subcarpetas (${theme.sampleSubfolder}). NO deben poder modificar ni eliminar archivos existentes, ni crear subcarpetas.`,
      contextNote: `Requiere combinar dos entradas con distinto «Se aplica a:» para no propagar la creación/escritura a archivos o subcarpetas.`,
      hint: `Entrada 1: «Solo esta carpeta» con Lectura y ejecución + «Crear archivos / escribir datos». Entrada 2: «Esta carpeta, subcarpetas y archivos» con solo Lectura y ejecución.`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.archiveFolder, false, false),
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
        const onF = computeLocalEffectivePermissions('target', 'primary', 'thisFolder', folders, principals);
        const onSub = computeLocalEffectivePermissions('target', 'primary', 'subfolders', folders, principals);
        const onFiles = computeLocalEffectivePermissions('target', 'primary', 'files', folders, principals);
        if (onF.has('createFilesWriteData') && onF.has('listRead')) {
          issues.push({ severity: 'success', title: 'Subida en la raíz permitida', detail: 'Pueden listar la carpeta y crear archivos nuevos en la raíz.' });
        } else {
          issues.push({ severity: 'error', title: 'No pueden entregar en la raíz', detail: 'Añade Lectura + «Crear archivos / escribir datos» en «Solo esta carpeta».' });
        }
        if (onSub.has('listRead') && onFiles.has('listRead')) {
          issues.push({ severity: 'success', title: 'Consulta en subcarpetas activa', detail: `Pueden leer archivos en ${theme.sampleSubfolder}.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura en subcarpetas', detail: 'Añade Lectura y ejecución en «Esta carpeta, subcarpetas y archivos».' });
        }
        if (onFiles.has('createFilesWriteData') || onSub.has('createFilesWriteData') || onF.has('createFoldersAppendData') || onFiles.has('delete')) {
          issues.push({ severity: 'error', title: 'Permisos excesivos de escritura o borrado', detail: 'No concedas escritura sobre archivos ni creación de subcarpetas ni Eliminar.' });
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
      title: `Recurso oculto ${shareTarget} limitado por Red (${theme.sector})`,
      category: 'Intersección Red y NTFS',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'supervisor',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `La carpeta ${targetPath} ya concede localmente NTFS «Modificar» a «${theme.groupSupervisor}». Compártela en red de forma OCULTA con el nombre exacto «${shareTarget}», pero restringiendo su permiso en red para que al conectar desde otro equipo solo puedan LEER (sin editar ni eliminar).`,
      contextNote: `No modifiques el permiso local NTFS; aplica la regla de intersección Red ∩ NTFS = mínimo.`,
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
      title: `Limitar administración de ACL por red en ${theme.projectFolder}`,
      category: 'Intersección Red y NTFS',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'lead',
      testAccessMode: 'network',
      focusTab: 'share',
      enunciado: `«${theme.groupLead}» tiene localmente NTFS Control Total en ${targetPath}. Sin embargo, cuando se conecte por red al recurso compartido «${theme.projectFolder}», debe poder leer, crear, modificar y eliminar contenido, pero NO debe poder cambiar permisos NTFS ni tomar posesión remotamente. Configura la pestaña Compartir (Red).`,
      contextNote: `El permiso de red «Cambiar» permite modificar/borrar objetos, pero bloquea «Cambiar permisos» y «Tomar posesión» a través de la red.`,
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
      title: `Solo anexar datos en registros de ${theme.logFolder} (${theme.sector})`,
      category: 'Permisos dobles',
      difficulty: 'Avanzado',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath} se guardan ficheros de registro (${theme.sampleLog}). «${theme.groupPrimary}» debe poder entrar en la carpeta, leer los logs y AÑADIR nuevas líneas al final de los archivos existentes (anexar datos), pero NO debe poder sobrescribir datos previos, NO crear archivos ni subcarpetas nuevos y NO eliminar nada.`,
      contextNote: `Prueba el segundo permiso doble: «Crear carpetas / anexar datos» significa «Anexar datos» al aplicarse a «Solo archivos».`,
      hint: `Entrada 1: «Solo esta carpeta» con Lectura y ejecución. Entrada 2: «Solo archivos» con Lectura + «Crear carpetas / anexar datos» (+ escribir atributos si se desea), SIN «Crear archivos / escribir datos» y SIN «Eliminar».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.logFolder, false, false),
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
        const onF = computeLocalEffectivePermissions('target', 'primary', 'thisFolder', folders, principals);
        const onFiles = computeLocalEffectivePermissions('target', 'primary', 'files', folders, principals);
        if (onF.has('listRead') && onFiles.has('listRead')) {
          issues.push({ severity: 'success', title: 'Lectura de carpeta y ficheros log', detail: 'Pueden abrir y consultar el archivo de registro.' });
        } else {
          issues.push({ severity: 'error', title: 'Falta lectura', detail: 'Concede Lectura y ejecución tanto en la carpeta como en los archivos.' });
        }
        if (onFiles.has('createFoldersAppendData') && !onFiles.has('createFilesWriteData')) {
          issues.push({ severity: 'success', title: 'Anexar datos sin sobrescritura', detail: '«Crear carpetas / anexar datos» sobre Solo archivos permite añadir líneas al final sin sobrescribir el historial.' });
        } else {
          issues.push({ severity: 'error', title: 'Configuración de anexado incorrecta', detail: 'En «Solo archivos», marca «Crear carpetas / anexar datos» y deja desmarcado «Crear archivos / escribir datos».' });
        }
        if (onF.has('createFilesWriteData') || onF.has('createFoldersAppendData') || onFiles.has('delete') || onF.has('delete')) {
          issues.push({ severity: 'error', title: 'Permisos excesivos de creación o borrado', detail: 'No concedas creación de archivos/carpetas en la carpeta ni permisos Eliminar.' });
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
      title: `Ejecutar herramientas sin leer código en ${theme.scriptFolder}`,
      category: 'Ejecución y Denegar',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'primary',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath} reside el programa ${theme.sampleScript}. «${theme.groupPrimary}» debe poder atravesar la carpeta y EJECUTAR los archivos ejecutables, pero NO debe poder listar la carpeta ni leer/copiar el contenido de los archivos ni modificar nada.`,
      contextNote: `El permiso doble «Atravesar carpeta / ejecutar archivo» habilita la ejecución sin requerir «Mostrar carpeta / leer datos».`,
      hint: `Aplica a «Esta carpeta y archivos» (o «Esta carpeta, subcarpetas y archivos») únicamente «Atravesar carpeta / ejecutar archivo» + lectura de atributos/permisos, SIN «Mostrar carpeta / leer datos».`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.scriptFolder, false, false),
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
        const onF = computeLocalEffectivePermissions('target', 'primary', 'thisFolder', folders, principals);
        const onFiles = computeLocalEffectivePermissions('target', 'primary', 'files', folders, principals);
        if (onF.has('traverse') && onFiles.has('traverse')) {
          issues.push({ severity: 'success', title: 'Atravesar y ejecutar habilitado', detail: `Pueden ejecutar ${theme.sampleScript} conociendo su ruta.` });
        } else {
          issues.push({ severity: 'error', title: 'Falta permiso de ejecución/atravesar', detail: 'Marca «Atravesar carpeta / ejecutar archivo» en «Esta carpeta y archivos».' });
        }
        if (!onF.has('listRead') && !onFiles.has('listRead')) {
          issues.push({ severity: 'success', title: 'Lectura y copiado bloqueados', detail: 'Sin «Mostrar carpeta / leer datos», no pueden listar ni leer el archivo.' });
        } else {
          issues.push({ severity: 'error', title: 'Pueden listar o leer el programa', detail: 'Desmarca «Mostrar carpeta / leer datos».' });
        }
        if (onF.has('createFilesWriteData') || onFiles.has('createFilesWriteData') || onFiles.has('delete')) {
          issues.push({ severity: 'error', title: 'Permisos de escritura o borrado activos', detail: 'Retira cualquier permiso de modificación o eliminación.' });
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
      title: `Prioridad de Denegar para ${theme.groupRestricted} (${theme.sector})`,
      category: 'Ejecución y Denegar',
      difficulty: 'Intermedio',
      sourcePractice: theme.sector,
      machineName: theme.machine,
      targetFolderId: 'target',
      targetPrincipalId: 'restricted',
      testAccessMode: 'local',
      focusTab: 'entry',
      enunciado: `En ${targetPath}, el grupo «${theme.groupPrimary}» ya tiene permiso de Modificar. Sin embargo, el subgrupo «${theme.groupRestricted}» (cuyos miembros pertenecen a ${theme.groupPrimary}) debe conservar la lectura pero tener DENEGADA explícitamente la escritura/creación y la eliminación sobre toda la carpeta, subcarpetas y archivos.`,
      contextNote: `En NTFS, cualquier entrada «Denegar» prevalece siempre sobre las entradas «Permitir» heredadas o de otros grupos.`,
      hint: `No quites a ${theme.groupPrimary}. Añade una entrada de tipo «Denegar» para «${theme.groupRestricted}» en «Esta carpeta, subcarpetas y archivos» marcando Crear archivos/escribir datos, Crear carpetas/anexar datos, Escribir atributos/extendidos, Eliminar subcarpetas y archivos y Eliminar.`,
      principals: makePrincipals(theme),
      initialFolders: [
        makeBaseRoot(theme, theme.projectFolder, false, false),
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
        const pFiles = computeLocalEffectivePermissions('target', 'primary', 'files', folders, principals);
        const rFolder = computeLocalEffectivePermissions('target', 'restricted', 'thisFolder', folders, principals);
        const rFiles = computeLocalEffectivePermissions('target', 'restricted', 'files', folders, principals);

        if (pFiles.has('createFilesWriteData') && pFiles.has('delete')) {
          issues.push({ severity: 'success', title: `Permisos de ${theme.groupPrimary} conservados`, detail: 'El resto de miembros mantiene el acceso Modificar.' });
        } else {
          issues.push({ severity: 'error', title: `Se modificó el acceso de ${theme.groupPrimary}`, detail: `Conserva la entrada Permitir Modificar de ${theme.groupPrimary}.` });
        }

        if (rFolder.has('listRead') && rFiles.has('listRead')) {
          issues.push({ severity: 'success', title: `Lectura preservada para ${theme.groupRestricted}`, detail: 'Pueden seguir leyendo la carpeta y archivos.' });
        } else {
          issues.push({ severity: 'error', title: `Se bloqueó también la lectura de ${theme.groupRestricted}`, detail: 'No marques Control total ni permisos de lectura en la regla Denegar.' });
        }

        if (!rFolder.has('createFilesWriteData') && !rFiles.has('createFilesWriteData') && !rFolder.has('createFoldersAppendData') && !rFiles.has('delete') && !rFolder.has('delete')) {
          issues.push({ severity: 'success', title: 'Escritura y eliminación denegadas eficazmente', detail: `Denegar anula los permisos heredados de ${theme.groupPrimary}.` });
        } else {
          issues.push({ severity: 'error', title: `${theme.groupRestricted} todavía puede escribir o borrar`, detail: `Añade una entrada «Denegar» para ${theme.groupRestricted} en «Esta carpeta, subcarpetas y archivos» bloqueando escritura, creación y eliminación.` });
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
