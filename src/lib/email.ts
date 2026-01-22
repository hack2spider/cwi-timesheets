import { Resend } from "resend";

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Admin email to receive notifications
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@cwi-facades.co.uk";

interface TimesheetNotificationData {
  action: "created" | "updated" | "deleted";
  timesheet: {
    id: string;
    date: Date;
    hoursWorked: number;
    oldHoursWorked?: number;
    userName: string;
    userEmail: string;
    projectName: string;
    status: string;
  };
  editorName: string;
}

export async function sendTimesheetNotification(data: TimesheetNotificationData) {
  const { action, timesheet, editorName } = data;

  const formattedDate = new Date(timesheet.date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let subject = "";
  let bodyText = "";

  switch (action) {
    case "created":
      subject = `Timesheet Created - ${timesheet.userName} - ${formattedDate}`;
      bodyText = `
A new timesheet entry has been created:

Operative: ${timesheet.userName}
Date: ${formattedDate}
Hours: ${timesheet.hoursWorked}
Project: ${timesheet.projectName}
Status: ${timesheet.status}
Created by: ${editorName}
      `.trim();
      break;

    case "updated":
      subject = `Timesheet Updated - ${timesheet.userName} - ${formattedDate}`;
      bodyText = `
A timesheet entry has been modified:

Operative: ${timesheet.userName}
Date: ${formattedDate}
${timesheet.oldHoursWorked !== undefined ? `Previous Hours: ${timesheet.oldHoursWorked}` : ""}
New Hours: ${timesheet.hoursWorked}
Project: ${timesheet.projectName}
Status: ${timesheet.status}
Modified by: ${editorName}
      `.trim();
      break;

    case "deleted":
      subject = `Timesheet Deleted - ${timesheet.userName} - ${formattedDate}`;
      bodyText = `
A timesheet entry has been deleted:

Operative: ${timesheet.userName}
Date: ${formattedDate}
Hours: ${timesheet.hoursWorked}
Project: ${timesheet.projectName}
Deleted by: ${editorName}
      `.trim();
      break;
  }

  // Send to admin
  const client = getResendClient();
  if (!client) {
    console.warn("Email notifications disabled: RESEND_API_KEY not configured");
    return;
  }

  try {
    await client.emails.send({
      from: "CWI Facades Timesheets <timesheets@cwi-facades.co.uk>",
      to: [ADMIN_EMAIL],
      subject,
      text: bodyText,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">CWI Facades - Timesheet Notification</h1>
          </div>
          <div style="padding: 20px; background-color: #f9fafb;">
            <h2 style="color: #1e40af; margin-top: 0;">Timesheet ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Operative:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${timesheet.userName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Date:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
              </tr>
              ${action === "updated" && timesheet.oldHoursWorked !== undefined ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Previous Hours:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${timesheet.oldHoursWorked}</td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${action === "deleted" ? "Hours:" : "New Hours:"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${timesheet.hoursWorked}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Project:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${timesheet.projectName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${action === "deleted" ? "Deleted by:" : action === "created" ? "Created by:" : "Modified by:"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${editorName}</td>
              </tr>
            </table>
          </div>
          <div style="padding: 15px; background-color: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
            This is an automated notification from CWI Facades Timesheet System
          </div>
        </div>
      `,
    });

    console.log(`Timesheet notification sent: ${action} - ${timesheet.userName}`);
  } catch (error) {
    console.error("Failed to send timesheet notification:", error);
    throw error;
  }
}
