import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-3xl text-foreground">foundation</h1>
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>UI kit</CardTitle>
          <CardDescription>
            base-nova primitives, dark + light tokens, motion tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">One</TabsTrigger>
              <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="pt-2 text-muted-foreground">
              First panel.
            </TabsContent>
            <TabsContent value="two" className="pt-2 text-muted-foreground">
              Second panel.
            </TabsContent>
          </Tabs>

          <Skeleton className="h-8 w-full" />

          <Dialog>
            <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Example dialog</DialogTitle>
                <DialogDescription>
                  Confirms Dialog, Button, and Card render correctly together.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Link
        href="/dashboard"
        className="text-primary underline underline-offset-4"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
