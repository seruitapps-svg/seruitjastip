import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendOrderPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        eventType: z.enum([
          "order_created",
          "order_status_changed",
          "merchant_order_ready",
          "merchant_rejected",
          "chat_message",
        ]),
        orderId: z.string().uuid(),
        messageId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { dispatchOrderPush } = await import("./push.server");
    return dispatchOrderPush({ ...data, callerId: context.userId });
  });
