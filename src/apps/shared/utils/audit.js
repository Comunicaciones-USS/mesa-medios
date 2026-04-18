/**
 * Inserts a single audit log entry, always serializing details as JSON.
 * Use this instead of calling supabase.from('audit_logs').insert() directly.
 */
export async function logAuditEntry(supabase, { mesa_type, user_email, action, table_name, record_id, details }) {
  return supabase.from('audit_logs').insert([{
    mesa_type:  mesa_type  ?? null,
    user_email,
    action,
    table_name: table_name ?? null,
    record_id:  record_id  ?? null,
    details: typeof details === 'string' ? details : JSON.stringify(details ?? {}),
  }])
}
