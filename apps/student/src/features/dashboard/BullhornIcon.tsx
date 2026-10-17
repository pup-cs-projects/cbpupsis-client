const BullhornIcon = ({
  size = undefined,
  color = "#000000",
  strokeWidth = 2,
  background = "transparent",
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
}) => {
  const transforms: string[] = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push("scaleX(-1)");
  if (flipVertical) transforms.push("scaleY(-1)");

  // Path uses Font Awesome's 1792×1792 coordinate space
  const baseSize = 1792;
  const viewBox = `${-padding} ${-padding} ${baseSize + padding * 2} ${baseSize + padding * 2}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity,
        transform: transforms.length > 0 ? transforms.join(" ") : undefined,
        filter:
          shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        backgroundColor: background !== "transparent" ? background : undefined,
      }}
    >
      <path
        fill="currentColor"
        d="M1664 512q53 0 90.5 37.5T1792 640t-37.5 90.5T1664 768v384q0 52-38 90t-90 38q-417-347-812-380q-58 19-91 66t-31 100.5t40 92.5q-20 33-23 65.5t6 58t33.5 55t48 50T768 1438q-29 58-111.5 83T488 1532.5T356 1477q-7-23-29.5-87.5t-32-94.5t-23-89t-15-101t3.5-98.5T282 896H160q-66 0-113-47T0 736V544q0-66 47-113t113-47h480q435 0 896-384q52 0 90 38t38 90zm-128 604V162q-394 302-768 343v270q377 42 768 341"
      />
    </svg>
  );
};

export default BullhornIcon;
