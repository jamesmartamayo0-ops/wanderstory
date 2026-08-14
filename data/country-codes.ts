const COUNTRY_CODES: Record<string, string> = {
  Japan: "JP",
  Vietnam: "VN",
  Italy: "IT",
  Switzerland: "CH",
  Canada: "CA",
  "United States": "US",
  Peru: "PE",
  Brazil: "BR",
  Kenya: "KE",
  "New Zealand": "NZ",
};

export function getCountryCode(country: string): string | null {
  return COUNTRY_CODES[country] ?? null;
}
