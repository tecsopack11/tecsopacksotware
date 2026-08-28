import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleSelect } from "@/components/admin/role-select";
import { SuperAdminToggle } from "@/components/admin/super-admin-toggle";

export const dynamic = "force-dynamic";

export default async function UsuariosAdminPage() {
  const supabase = await createClient();
  const session = await getProfile();
  const canManageSuperAdmin = session?.profile.is_super_admin === true;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, is_super_admin, created_at")
    .order("created_at");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios ({profiles?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Super Admin</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(profiles ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.full_name || "(sin nombre)"}</TableCell>
                <TableCell>
                  <RoleSelect profileId={p.id} currentRole={p.role} />
                </TableCell>
                <TableCell>
                  <SuperAdminToggle
                    profileId={p.id}
                    isSuperAdmin={p.is_super_admin}
                    disabled={!canManageSuperAdmin}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("es-CL")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!canManageSuperAdmin && (
          <p className="mt-3 text-xs text-muted-foreground">
            Solo un Super Admin puede otorgar o quitar este permiso.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
