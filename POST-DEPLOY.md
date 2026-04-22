# Post-deploy — verificación y cierre

## 1. Verificar login (ahora)

Abrir https://comunicaciones-uss.github.io/sistema-gestion/
en ventana incógnita. Intentar loguearte con tu email y PIN.

- ✅ Si entras → pasar al paso 2.
- ❌ Si NO entras → ir a sección "Rollback de emergencia" abajo.

## 2. Cerrar el agujero (cuando confirmaste que el login funciona)

Pegar el contenido de `scripts/security-rpc-cleanup.sql` en el
SQL Editor de Supabase y ejecutar. Es UNA sola línea:

```sql
DROP POLICY "anon_can_read_active_users" ON usuarios_autorizados;
```

Después, volver a probar el login en incógnita. Si sigue
funcionando, estás listo.

## 3. Rollback de emergencia (solo si el login nuevo falla)

1. Abrir https://github.com/Comunicaciones-USS/sistema-gestion
2. Ir a `src/apps/shared/components/Login.jsx`
3. Click en el ícono de lápiz (editar)
4. Seguir las instrucciones del bloque `🔙 ROLLBACK DE EMERGENCIA`
   que está al principio del bloque de validación
5. Descomentar el bloque viejo → comentar el bloque nuevo
6. Commit directo a main con mensaje `rollback: login v1`
7. Pedir a Claude Code que haga `npm run deploy` desde esta máquina

---

**NOTA:** Mientras no ejecutes el paso 2, el agujero de seguridad
sigue abierto. Pero NO ejecutes el paso 2 hasta confirmar el
paso 1. Ese es el orden que te protege.
