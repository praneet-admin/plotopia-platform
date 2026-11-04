import type { SectionKey } from "@/lib/settings";

export type Field =
  | { key: string; label: string; type: "text" | "textarea" | "number" | "bool" | "color" | "url"; hint?: string; step?: number; min?: number; max?: number }
  | { key: string; label: string; type: "list"; hint?: string }
  | { key: string; label: string; type: "image"; hint?: string }
  | { key: string; label: string; type: "select"; options: [string, string][]; hint?: string }
  | { key: string; label: string; type: "featured"; hint?: string };

export const TABS: { key: SectionKey; label: string; blurb: string; preview: string | null; previewLabel: string }[] = [
  { key: "brand", label: "Brand", blurb: "Name, logo, colour and footer across the whole site.", preview: "/", previewLabel: "Open home page" },
  { key: "cinema", label: "Cinema", blurb: "City, support contacts and the theatres list.", preview: "/theatres", previewLabel: "Open theatres page" },
  { key: "home", label: "Home page", blurb: "Heading, banner, promo strip, featured films and which sections show.", preview: "/", previewLabel: "Open home page" },
  { key: "booking", label: "Booking rules", blurb: "Hold timeout, seat limits, fees, GST, refunds and channels.", preview: null, previewLabel: "Open a movie page" },
  { key: "payment", label: "Payment", blurb: "UPI collection details and the payment page copy.", preview: null, previewLabel: "Open a pending payment" },
  { key: "messages", label: "Messages", blurb: "Templates for confirmation, cancellation and reminders.", preview: "/admin/messages", previewLabel: "See sent messages" },
  { key: "simulator", label: "Simulator", blurb: "The 3D hall the showtimes open, its screen image, and hall ids.", preview: null, previewLabel: "Open simulator" },
];

export const FIELDS: Record<SectionKey, Field[]> = {
  brand: [
    { key: "siteName", label: "Site name", type: "text", hint: "Browser titles, tickets, messages." },
    { key: "tagline", label: "Tagline", type: "text" },
    { key: "description", label: "Description", type: "textarea", hint: "Shown on the sign-in page and used for search engines." },
    { key: "accent", label: "Accent colour", type: "color", hint: "Buttons, highlights, selected chips." },
    { key: "logoUrl", label: "Logo mark", type: "image", hint: "Square. Upload a PNG/SVG under 400 KB or paste a URL. Leave empty for the built-in mark." },
    { key: "wordmarkUrl", label: "Wordmark", type: "image", hint: "Wide logo next to the mark." },
    { key: "faviconUrl", label: "Favicon", type: "image" },
    { key: "footerText", label: "Footer text", type: "text" },
    { key: "showStaffLink", label: "Show the Staff link in the footer", type: "bool" },
  ],
  cinema: [
    { key: "city", label: "City", type: "text", hint: "Used in headings such as “Movies in {city}”." },
    { key: "supportEmail", label: "Support email", type: "text" },
    { key: "supportPhone", label: "Support phone", type: "text" },
    { key: "whatsapp", label: "WhatsApp number", type: "text", hint: "With country code, e.g. 919840012345. Adds a WhatsApp link to the footer." },
  ],
  home: [
    { key: "heading", label: "Heading", type: "text", hint: "{city} is replaced with the city from the Cinema tab." },
    { key: "subheading", label: "Subheading", type: "text", hint: "Empty shows today's date and the film count." },
    { key: "heroImageUrl", label: "Banner image", type: "image", hint: "Wide image above the list. Empty hides the banner." },
    { key: "promoText", label: "Promo strip text", type: "text", hint: "A line above the heading, e.g. “Buy 2 get 1 free on Tuesdays”." },
    { key: "promoLink", label: "Promo strip link", type: "url" },
    { key: "featured", label: "Featured films", type: "featured", hint: "Give a position to pin films at the top, in that order. Everything else follows by release date." },
    { key: "showFilters", label: "Show the filter row", type: "bool" },
    { key: "showPlayingAt", label: "Show “playing at” under each poster", type: "bool" },
    { key: "showTheatresLink", label: "Show the Theatres link", type: "bool" },
    { key: "showComingSoon", label: "Show a Coming soon row", type: "bool", hint: "Films with status “coming soon”." },
  ],
  booking: [
    { key: "holdMinutes", label: "Seat hold (minutes)", type: "number", min: 2, max: 30, hint: "How long picked seats stay reserved before payment." },
    { key: "maxSeats", label: "Max seats per order", type: "number", min: 1, max: 20 },
    { key: "feePerTicket", label: "Convenience fee per ticket (₹)", type: "number", min: 0, hint: "Online orders only. Counter sales never carry a fee." },
    { key: "gstPct", label: "GST (%)", type: "number", min: 0, max: 28, step: 0.5, hint: "Applied on seat price plus fee, shown as a separate line." },
    { key: "closeMinutesAfterStart", label: "Close booking (minutes after start)", type: "number", min: 0, max: 120 },
    { key: "gateOpensHoursBefore", label: "Gates open (hours before)", type: "number", min: 0, max: 24, step: 0.5 },
    { key: "fullRefundHours", label: "Full refund until (hours before)", type: "number", min: 0 },
    { key: "partialRefundHours", label: "Partial refund until (hours before)", type: "number", min: 0 },
    { key: "partialRefundPct", label: "Partial refund (%)", type: "number", min: 0, max: 100 },
    { key: "policyText", label: "Policy wording", type: "textarea", hint: "Placeholders: {fullHours} {partialHours} {partialPct}." },
    { key: "allowOnline", label: "Allow online booking", type: "bool", hint: "Off pauses the public checkout; counter sales still work." },
    { key: "allowCounterCash", label: "Allow cash at the counter", type: "bool" },
  ],
  payment: [
    { key: "upiId", label: "UPI ID", type: "text", hint: "The VPA that collects the money. This is what the QR encodes." },
    { key: "payeeName", label: "Payee name", type: "text", hint: "Shown in the customer's UPI app and on the pay page." },
    { key: "apps", label: "Accepted apps", type: "list", hint: "One per line. Listed under the Google Pay button." },
    { key: "title", label: "Pay page title", type: "text" },
    { key: "instructions", label: "Instructions", type: "textarea" },
    { key: "testMode", label: "Test mode", type: "bool", hint: "On: shows the TEST MODE pill and the “Payment didn't go through” button. Off: hides both." },
    { key: "testModeNote", label: "Test mode note", type: "textarea" },
  ],
  messages: [
    { key: "confirmation", label: "Confirmation (WhatsApp / email)", type: "textarea" },
    { key: "confirmationSms", label: "Confirmation (SMS)", type: "textarea" },
    { key: "cancellation", label: "Cancellation", type: "textarea" },
    { key: "refundLine", label: "Refund line", type: "text", hint: "Inserted as {refundLine} when a refund applies." },
    { key: "noRefundLine", label: "No-refund line", type: "text" },
    { key: "reminder", label: "Reminder", type: "textarea", hint: "Sent from Bookings → Remind." },
  ],
  simulator: [
    { key: "url", label: "Simulator URL", type: "url", hint: "Where showtimes send customers to pick a seat." },
    { key: "screenImageUrl", label: "Screen image", type: "image", hint: "Shown on the hall's cinema screen in 3D. Empty uses the simulator's own image." },
    { key: "showSeatPreview", label: "Show “view from seat” links", type: "bool", hint: "On checkout, tickets and the footer." },
    { key: "sendCast", label: "Send the cast to the simulator header", type: "bool" },
  ],
};

export const PLACEHOLDERS = "{name} {fullName} {title} {screen} {time} {seats} {total} {id} {link} {site} {gateHours} {refund} {refundLine}";
