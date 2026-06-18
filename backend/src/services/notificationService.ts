// Notification service — handles push notifications and in-app messaging delivery.

/**
 * Sends a push notification to a specific user's device.
 *
 * TODO: Integrate with Firebase Cloud Messaging (FCM) or a similar provider.
 *       Use the user's `deviceToken` from the database.
 */
export async function sendPushNotification(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  console.log(
    `[NotificationService] Sending push to user ${userId}: "${title}" — "${body}"`
  );

  // TODO: Look up user's deviceToken
  // TODO: Send via FCM or equivalent
}

/**
 * Sends a notification to all users in a firm.
 *
 * TODO: Fetch all active users with device tokens and batch-send.
 */
export async function sendFirmNotification(
  firmId: number,
  title: string,
  body: string
): Promise<void> {
  console.log(
    `[NotificationService] Broadcasting to firm ${firmId}: "${title}"`
  );

  // TODO: Batch send to all active devices in the firm
}

/**
 * Sends a WhatsApp message (for quotation delivery).
 *
 * TODO: Integrate with WhatsApp Business API or a provider like Twilio.
 */
export async function sendWhatsApp(
  phone: string,
  message: string,
  pdfUrl?: string
): Promise<void> {
  console.log(
    `[NotificationService] Sending WhatsApp to ${phone}: "${message.slice(0, 50)}..."`
  );

  // TODO: Implement WhatsApp API integration
}

/**
 * Sends an email notification.
 *
 * TODO: Integrate with an email provider (SendGrid, SES, etc.).
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  console.log(
    `[NotificationService] Sending email to ${to}: "${subject}"`
  );

  // TODO: Implement email sending
}
