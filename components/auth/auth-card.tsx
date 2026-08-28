"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn, signUp, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = { error: null };

export function AuthCard() {
  const [loginState, loginAction, loginPending] = useActionState(signIn, initialState);
  const [signupState, signupAction, signupPending] = useActionState(signUp, initialState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Image src="/logo.png" alt="Tecsopack" width={220} height={139} priority className="mb-2 h-auto w-40" />
        <CardTitle>Tecsopack</CardTitle>
        <CardDescription>Inventario de materia prima y OEE</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">Ingresar</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form action={loginAction} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Correo</Label>
                <Input id="login-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
              </div>
              {loginState.error && (
                <Alert variant="destructive">
                  <AlertDescription>{loginState.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loginPending}>
                {loginPending ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form action={signupAction} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nombre completo</Label>
                <Input id="signup-name" name="full_name" required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Correo</Label>
                <Input id="signup-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Contraseña</Label>
                <Input id="signup-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              {signupState.error && (
                <Alert variant="destructive">
                  <AlertDescription>{signupState.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={signupPending}>
                {signupPending ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Las cuentas nuevas empiezan con rol de operario. Un administrador puede
                ascender tu rol después desde Administración.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
