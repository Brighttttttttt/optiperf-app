import { ImageResponse } from "next/og";

// iOS n'applique pas de masque : on dessine directement les coins arrondis
// et on réduit le tracé pour laisser respirer les bords.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#17604c",
        }}
      >
        <svg
          width="118"
          height="118"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f2f5f1"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
        </svg>
      </div>
    ),
    size
  );
}
