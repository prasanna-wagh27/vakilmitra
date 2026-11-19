import { JusticeScale01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input-base";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { meQuery, type Staff } from "@/lib/queries";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [v, setV] = useState({ email: "", password: "", code: "" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const login = useMutation({
    mutationFn: () => api<{ staff: Staff }>("/login", { body: v }),
    onSuccess: async (r) => {
      qc.setQueryData(meQuery.queryKey, r.staff);
      await navigate({ to: "/" });
    },
    onError: () => setV((x) => ({ ...x, code: "" })),
  });

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={JusticeScale01Icon} className="size-5" />
          </span>
          <CardTitle className="text-xl">VakilMitra Admin</CardTitle>
          <CardDescription>Staff only. Every sign-in is recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={v.email}
                onChange={(e) => setV({ ...v, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={v.password}
                onChange={(e) => setV({ ...v, password: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Authenticator code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={v.code}
                onChange={(e) => setV({ ...v, code: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <ErrorBox error={login.error} />
            <Button type="submit" size="lg" disabled={login.isPending}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
