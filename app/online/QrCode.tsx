import { useMemo } from "react";
import { encode } from "uqr";

type QrCodeProps = { value: string; label: string; className?: string };

/** QR code drawn as one SVG path. Dark on light whatever the theme, as scanners expect. */
const QrCode = ({ value, label, className }: QrCodeProps) => {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      })
    );
    return { size: qr.size, path: d };
  }, [value]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
};

export default QrCode;
