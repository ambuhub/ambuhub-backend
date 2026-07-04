import type {
  NotificationCategory,
  NotificationPriority,
  NotificationType,
} from "../../models/notification.model";

export { notificationCategoryValues } from "../../models/notification.model";
export type { NotificationCategory, NotificationPriority, NotificationType };

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationCategory,
  boolean
> = {
  ambulance_updates: true,
  booking_updates: true,
  payments: true,
  chat_messages: true,
  concierge: true,
  marketing: true,
  general: true,
};

const typeCategoryMap: Record<NotificationType, NotificationCategory> = {
  ambulance_request: "ambulance_updates",
  request_accepted: "ambulance_updates",
  request_rejected: "ambulance_updates",
  ambulance_en_route: "ambulance_updates",
  ambulance_arrived: "ambulance_updates",
  hire_return_reminder: "booking_updates",
  provider_hire_booked: "booking_updates",
  provider_hire_return_reminder: "booking_updates",
  provider_booking_confirmed: "booking_updates",
  booking_confirmed: "booking_updates",
  booking_cancelled: "booking_updates",
  provider_sale_purchased: "payments",
  payment_success: "payments",
  payment_failed: "payments",
  chat_message: "chat_messages",
  order_shipped: "booking_updates",
  order_delivered: "booking_updates",
  general: "general",
};

const typePriorityMap: Record<NotificationType, NotificationPriority> = {
  ambulance_request: "critical",
  ambulance_en_route: "critical",
  ambulance_arrived: "critical",
  request_accepted: "normal",
  request_rejected: "high",
  payment_failed: "high",
  booking_cancelled: "high",
  hire_return_reminder: "normal",
  provider_hire_return_reminder: "normal",
  provider_hire_booked: "normal",
  provider_booking_confirmed: "normal",
  provider_sale_purchased: "normal",
  booking_confirmed: "normal",
  payment_success: "normal",
  chat_message: "normal",
  order_shipped: "normal",
  order_delivered: "normal",
  general: "low",
};

export function categoryForType(type: NotificationType): NotificationCategory {
  return typeCategoryMap[type] ?? "general";
}

export function priorityForType(type: NotificationType): NotificationPriority {
  return typePriorityMap[type] ?? "normal";
}

export function isHighFcmPriority(priority: NotificationPriority): boolean {
  return priority === "critical" || priority === "high";
}
