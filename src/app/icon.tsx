import { ImageResponse } from "next/og";

// Icône générée à la construction : pas de binaire à versionner, et elle
// suit automatiquement la palette de l'app.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        {/* Le tracé du pouls, signature visuelle de l'app. */}
        <svg
          width="340"
          height="340"
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
