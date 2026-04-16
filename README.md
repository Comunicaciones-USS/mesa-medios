# Sistema de Gestión - Mesa Editorial y de Medios USS

**Dashboard colaborativo de planificación editorial y de medios** para la Dirección de Comunicaciones de la Universidad San Sebastián.

---

## 📋 Descripción

Esta aplicación es una herramienta interna que integra:

- **Mesa de Medios** (planificación y seguimiento de cobertura mediática)
- **Mesa Editorial** (gestión de contenidos y acciones editoriales)

Permite al equipo trabajar de forma **colaborativa en tiempo real**, con actualizaciones instantáneas, historial de cambios y perfiles de usuario.

El sistema fue desarrollado **por una sola persona** (iterando con Claude Code) y ya está siendo utilizado activamente por el equipo de Comunicaciones USS.

---

## 🌐 Demo en Vivo

**[Acceder al Dashboard →](https://comunicaciones-uss.github.io/sistema-gestion/)**

*(Requiere cuenta de Supabase del equipo. Contacta al administrador si necesitas acceso.)*

---

## ✨ Características Principales

- ✅ Actualización en tiempo real (Supabase Realtime)
- ✅ Dos módulos integrados: Mesa de Medios y Mesa Editorial
- ✅ Sistema de perfiles de usuario y login
- ✅ Historial completo de auditoría (`audit_logs`)
- ✅ Edición inline (ContentEditable) con guardado optimista
- ✅ Atajos de teclado
- ✅ Responsive (funciona en móvil y escritorio)
- ✅ Despliegue automático en GitHub Pages
- ✅ Seguridad básica a nivel de Supabase (RLS)

---

## 🛠️ Tecnologías

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Estilos**: Tailwind CSS
- **Despliegue**: GitHub Pages (CI/CD automático)
- **Otros**: React Router, date-fns, lucide-react

---

## 🚀 Instalación Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/Comunicaciones-USS/sistema-gestion.git
cd sistema-gestion

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# ← Edita el archivo .env con tus credenciales de Supabase
```
Luego ejecuta:
```bash
npm run dev
```
La aplicación estará disponible en http://localhost:5173

---

## 🔧 Configuración de Supabase

En la raíz del repositorio encontrarás tres scripts SQL listos para ejecutar:

- supabase-setup.sql → Tablas principales y funciones
- supabase-editorial-setup.sql → Tablas específicas de Mesa Editorial
- supabase-security-setup.sql → Políticas RLS y seguridad

Ejecútalos en orden en tu proyecto de Supabase.

---

## 📸 Capturas de pantalla

>***Próximamente***<br>
> *Aún estamos puliendo la interfaz y agregando mejoras. Tan pronto como el diseño se estabilice, se agregarán capturas.*

---

## 🤝 Cómo contribuir

El proyecto está en desarrollo activo y es usado diariamente por el equipo.
Revisa el archivo DIAGNOSTICO.md (contiene los issues técnicos conocidos y deuda técnica priorizada).
Si encuentras un bug o tienes una mejora: Abre un Issue describiendo el problema.
O crea un Pull Request directamente.

Cualquier feedback es bienvenido. ¡Gracias por ayudar a mantener y mejorar la herramienta!

---

## 🛤️ Roadmap / Próximas mejoras

- Limpieza de código muerto (src/components/, hooks antiguos, etc.)
- Corrección de bugs identificados en DIAGNOSTICO.md
- ESLint + Prettier
- Tests básicos
- Migración progresiva a TypeScript
- Filtros avanzados y virtualización de tablas
- Mejoras en UX (inputs de fecha controlados, guardado automático, etc.)

---

## 📄 Licencia

Este proyecto es privado e interno de la Dirección de Comunicaciones USS.
Todos los derechos reservados © 2025-2026.

---









