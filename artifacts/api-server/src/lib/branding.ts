/**
 * Centralized branding configuration for all exported reports.
 *
 * All export formats (PDF, DOCX, PPTX) consume this config so branding
 * is never duplicated across builders.
 */

export interface BrandingConfig {
  companyName: string;
  logoPlaceholder: string;
  /** Hex color — used for cover accents and headings */
  primaryColor: string;
  /** Hex color — used for secondary text and dividers */
  secondaryColor: string;
  /** Hex color — used for accent bars and highlights */
  accentColor: string;
  /** Short line printed in every footer, e.g. "Confidential — Prepared by Acme Corp" */
  reportFooter: string;
  /** Consultant / company name shown on cover and header */
  preparedBy: string;
  website: string;
  contactInformation: string;
}

/**
 * Default branding. Override by reading from environment variables or a
 * future settings table without changing the builders.
 */
export const defaultBranding: BrandingConfig = {
  companyName: process.env["BRAND_COMPANY_NAME"] ?? "Viral Magic",
  logoPlaceholder: process.env["BRAND_LOGO_PLACEHOLDER"] ?? "[COMPANY LOGO]",
  primaryColor: process.env["BRAND_PRIMARY_COLOR"] ?? "#0f172a",
  secondaryColor: process.env["BRAND_SECONDARY_COLOR"] ?? "#334155",
  accentColor: process.env["BRAND_ACCENT_COLOR"] ?? "#4c1d95",
  reportFooter:
    process.env["BRAND_FOOTER"] ??
    "Confidential — Prepared by Viral Magic OS",
  preparedBy: process.env["BRAND_PREPARED_BY"] ?? "Viral Magic Consulting",
  website: process.env["BRAND_WEBSITE"] ?? "viralmagic.com",
  contactInformation: process.env["BRAND_CONTACT"] ?? "",
};
