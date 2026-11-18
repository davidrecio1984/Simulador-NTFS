# Simulador NTFS — Consola Interactiva de Permisos Windows

Aplicación web educativa para practicar **permisos locales NTFS** y **permisos de recursos compartidos en red (SMB)** en entornos Windows sin necesidad de virtualizar máquinas virtuales.

## Funcionalidades

- **Modo examen**: exámenes aleatorios de 5 escenarios extraídos de un banco de 320 retos reales, con calificación final sobre 10 y revisión detallada por pregunta.
- **Banco de retos (320 escenarios)**: filtrable por categoría (buzón de entrega ciega, permisos dobles, herencia, intersección Red ∩ NTFS, etc.) y dificultad.
- **Consola NTFS interactiva**: configuración de herencia, selección de las 7 combinaciones de *Se aplica a:* y los 14 permisos avanzados, más pestaña *Compartir (Red)* y *Acceso efectivo*.
- **Laboratorio libre y Guía de permisos**: entorno sandbox y calculadora interactiva de intersección `Red ∩ NTFS`.

## Cómo publicarlo en GitHub Pages

1. Descarga o exporta este proyecto desde Google AI Studio.
2. Crea un nuevo repositorio público en [GitHub](https://github.com/new) (por ejemplo, `simulador-ntfs`).
3. Sube los archivos del proyecto a la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "Subir Simulador NTFS"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/simulador-ntfs.git
   git push -u origin main
   ```
4. En tu repositorio de GitHub, entra en **Settings → Pages**.
5. En **Build and deployment → Source**, elige **GitHub Actions**.
6. En 1–2 minutos se ejecutará el flujo `.github/workflows/deploy.yml` y aparecerá tu enlace público:
   `https://TU_USUARIO.github.io/simulador-ntfs/`

## Desarrollo local

```bash
npm install
npm run dev
```
