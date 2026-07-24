"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { contactAction } from "@/actions/contact-action";
import { contactFormSchema } from "@/lib/contact-schema";
import { EASE_OUT_QUART } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ContactFormValues = z.infer<typeof contactFormSchema>;

const fieldClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ContactForm() {
  const reducedMotion = useReducedMotion();
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", message: "" },
  });

  // react-hook-form only computes formState.isValid after the first
  // validation pass. Trigger one on mount so the submit button starts in the
  // correct disabled state instead of showing "valid" until the user
  // interacts with a field.
  useEffect(() => {
    form.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const action = useAction(contactAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        form.reset();
      }
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    action.execute(values);
  });

  const { isPending } = action;
  const sent = action.hasSucceeded && action.result.data?.success === true;
  const failedMessage =
    action.hasSucceeded && action.result.data?.success === false
      ? action.result.data.message
      : action.hasErrored
        ? "Something went wrong. Try again."
        : null;

  if (sent) {
    return (
      <div className="w-full rounded-xl border border-border bg-surface p-6 sm:p-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
        >
          <div className="mx-auto mb-4 flex w-fit items-center justify-center rounded-full border border-border bg-muted p-2 text-accent">
            <Check className="size-5" aria-hidden />
          </div>
          <h3 className="text-center text-lg font-medium text-foreground">
            Message sent
          </h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We read every note ourselves. Expect a reply from a person.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className={fieldClasses}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={fieldClasses}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="message"
          className="text-sm font-medium text-foreground"
        >
          Message
        </label>
        <textarea
          id="message"
          rows={5}
          className={cn(fieldClasses, "resize-none")}
          {...form.register("message")}
        />
        {form.formState.errors.message && (
          <p className="text-xs text-destructive">
            {form.formState.errors.message.message}
          </p>
        )}
      </div>

      {failedMessage && (
        <motion.p
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{failedMessage}</span>
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={!form.formState.isValid || isPending}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        className={cn(
          "inline-flex items-center justify-center gap-2 self-start rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Sending
          </>
        ) : (
          "Send message"
        )}
      </motion.button>
    </form>
  );
}
