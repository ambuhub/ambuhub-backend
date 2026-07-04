import type {
  NotificationCategory,
  NotificationPriority,
  NotificationReminderKind,
  NotificationType,
} from "../../models/notification.model";
import {
  categoryForType,
  priorityForType,
} from "./notification-categories";
import { formatDeadlineWat } from "./notification-format";

export type NotificationTemplateResult = {
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  deepLink: string;
  entityId?: string;
  data?: Record<string, string>;
  orderId?: string;
  serviceId?: string;
  receiptNumber?: string;
  deadlineAt?: Date;
  reminderKind?: NotificationReminderKind;
  /** When true, persist to AdminNotification instead of Notification */
  adminInbox?: boolean;
  adminType?: "concierge_request_received";
  conciergeRequestId?: string;
};

function baseTemplate(
  type: NotificationType,
  title: string,
  body: string,
  deepLink: string,
  extras: Partial<NotificationTemplateResult> = {},
): NotificationTemplateResult {
  const category = extras.category ?? categoryForType(type);
  const priority = extras.priority ?? priorityForType(type);
  return {
    type,
    category,
    priority,
    title,
    body,
    deepLink,
    ...extras,
  };
}

export const NotificationTemplates = {
  paymentSuccess(input: {
    orderId: string;
    receiptNumber: string;
    role: "client" | "provider";
  }): NotificationTemplateResult {
    const deepLink =
      input.role === "client"
        ? `/receipts/${encodeURIComponent(input.orderId)}`
        : "/provider/bookings";
    return baseTemplate(
      "payment_success",
      "Payment successful",
      `Your payment for receipt ${input.receiptNumber} was successful.`,
      deepLink,
      {
        entityId: input.orderId,
        orderId: input.orderId,
        receiptNumber: input.receiptNumber,
        data: { receiptNumber: input.receiptNumber },
      },
    );
  },

  paymentFailed(input: {
    orderId: string;
    reason?: string;
  }): NotificationTemplateResult {
    const reason = input.reason?.trim();
    return baseTemplate(
      "payment_failed",
      "Payment failed",
      reason
        ? `Your payment could not be completed: ${reason}`
        : "Your payment could not be completed. Please try again.",
      "/checkout",
      {
        entityId: input.orderId,
        orderId: input.orderId,
        priority: "high",
      },
    );
  },

  bookingConfirmed(input: {
    orderId: string;
    serviceId: string;
    serviceTitle: string;
    receiptNumber: string;
    role: "client" | "provider";
    bookEnd?: Date;
  }): NotificationTemplateResult {
    const when = input.bookEnd ? formatDeadlineWat(input.bookEnd) : null;
    const deepLink =
      input.role === "client"
        ? `/receipts/${encodeURIComponent(input.orderId)}`
        : "/provider/bookings";
    const body =
      input.role === "provider"
        ? `Your listing "${input.serviceTitle}" was booked (receipt ${input.receiptNumber})${when ? `. Session ends ${when} WAT.` : "."}`
        : `Your booking for "${input.serviceTitle}" is confirmed (receipt ${input.receiptNumber}).`;

    return baseTemplate(
      input.role === "provider" ? "provider_booking_confirmed" : "booking_confirmed",
      input.role === "provider" ? "New booking" : "Booking confirmed",
      body,
      deepLink,
      {
        entityId: input.orderId,
        orderId: input.orderId,
        serviceId: input.serviceId,
        receiptNumber: input.receiptNumber,
        deadlineAt: input.bookEnd,
        data: { receiptNumber: input.receiptNumber },
      },
    );
  },

  providerHireBooked(input: {
    orderId: string;
    serviceId: string;
    serviceTitle: string;
    receiptNumber: string;
    hireEnd?: Date;
  }): NotificationTemplateResult {
    const when = input.hireEnd ? formatDeadlineWat(input.hireEnd) : null;
    return baseTemplate(
      "provider_hire_booked",
      "New hire booking",
      `Your listing "${input.serviceTitle}" was hired (receipt ${input.receiptNumber})${when ? `. Return due ${when} WAT.` : "."}`,
      "/provider/bookings",
      {
        entityId: input.orderId,
        orderId: input.orderId,
        serviceId: input.serviceId,
        receiptNumber: input.receiptNumber,
        deadlineAt: input.hireEnd,
        data: { receiptNumber: input.receiptNumber },
      },
    );
  },

  providerSalePurchased(input: {
    orderId: string;
    serviceId: string;
    serviceTitle: string;
    receiptNumber: string;
  }): NotificationTemplateResult {
    return baseTemplate(
      "provider_sale_purchased",
      "New sale",
      `Someone purchased "${input.serviceTitle}" (receipt ${input.receiptNumber}).`,
      "/provider/listings",
      {
        entityId: input.orderId,
        orderId: input.orderId,
        serviceId: input.serviceId,
        receiptNumber: input.receiptNumber,
        data: { receiptNumber: input.receiptNumber },
      },
    );
  },

  hireReturnReminder(input: {
    orderId: string;
    serviceId: string;
    serviceTitle: string;
    deadlineAt: Date;
    reminderKind: NotificationReminderKind;
    role: "client" | "provider";
  }): NotificationTemplateResult {
    const when = formatDeadlineWat(input.deadlineAt);
    const isProvider = input.role === "provider";
    const type: NotificationType = isProvider
      ? "provider_hire_return_reminder"
      : "hire_return_reminder";

    if (isProvider) {
      const title =
        input.reminderKind === "1d"
          ? "Hire return in 24 hours"
          : "Hire return in 1 hour";
      const body =
        input.reminderKind === "1d"
          ? `A customer should return "${input.serviceTitle}" in about 24 hours (${when} WAT). Check Bookings for details.`
          : `A customer should return "${input.serviceTitle}" in about 1 hour (${when} WAT).`;
      return baseTemplate(type, title, body, "/provider/bookings", {
        entityId: input.orderId,
        orderId: input.orderId,
        serviceId: input.serviceId,
        deadlineAt: input.deadlineAt,
        reminderKind: input.reminderKind,
        priority: input.reminderKind === "1h" ? "high" : "normal",
      });
    }

    const title =
      input.reminderKind === "1d"
        ? "Hire return due in 24 hours"
        : "Hire return due in 1 hour";
    const body =
      input.reminderKind === "1d"
        ? `Your hire return for "${input.serviceTitle}" is due in about 24 hours (${when} WAT). View your receipt for details.`
        : `Your hire return for "${input.serviceTitle}" is due in about 1 hour (${when} WAT). Please return the item on time.`;

    return baseTemplate(type, title, body, `/receipts/${encodeURIComponent(input.orderId)}`, {
      entityId: input.orderId,
      orderId: input.orderId,
      serviceId: input.serviceId,
      deadlineAt: input.deadlineAt,
      reminderKind: input.reminderKind,
      priority: input.reminderKind === "1h" ? "high" : "normal",
    });
  },

  conciergeRequestReceived(input: {
    requestId: string;
    name: string;
    categoryName: string;
    departmentName: string;
  }): NotificationTemplateResult {
    return baseTemplate(
      "general",
      "New concierge request",
      `${input.name} submitted a request for ${input.categoryName} · ${input.departmentName}.`,
      `/admin/concierge-requests/${encodeURIComponent(input.requestId)}`,
      {
        category: "concierge",
        priority: "normal",
        entityId: input.requestId,
        adminInbox: true,
        adminType: "concierge_request_received",
        conciergeRequestId: input.requestId,
        data: {
          conciergeRequestId: input.requestId,
        },
      },
    );
  },

  ambulanceAccepted(input: { requestId: string }): NotificationTemplateResult {
    return baseTemplate(
      "request_accepted",
      "Ambulance request accepted",
      "Your ambulance request has been accepted.",
      `/client/orders`,
      {
        entityId: input.requestId,
        data: { requestId: input.requestId },
      },
    );
  },

  chatMessage(input: {
    chatId: string;
    senderName: string;
    preview: string;
    role: "client" | "provider";
  }): NotificationTemplateResult {
    const deepLink =
      input.role === "provider"
        ? `/provider/messages`
        : `/client/concierge`;
    return baseTemplate(
      "chat_message",
      `Message from ${input.senderName}`,
      input.preview,
      deepLink,
      {
        entityId: input.chatId,
        data: { chatId: input.chatId },
      },
    );
  },

  general(input: {
    title: string;
    body: string;
    deepLink?: string;
    entityId?: string;
  }): NotificationTemplateResult {
    return baseTemplate(
      "general",
      input.title,
      input.body,
      input.deepLink ?? "/client/dashboard",
      {
        entityId: input.entityId,
        priority: "low",
      },
    );
  },
};
