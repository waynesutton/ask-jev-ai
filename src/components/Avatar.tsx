// A photo, or the first letter of the handle on ink. Same shape at every
// size so cards, menus, and profiles line up.
export function Avatar({
  photoUrl,
  handle,
  size = 28,
}: {
  photoUrl: string | null;
  handle: string;
  size?: number;
}) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
  };
  if (photoUrl) {
    return (
      <img
        className="avatar"
        src={photoUrl}
        alt=""
        style={style}
        width={size}
        height={size}
      />
    );
  }
  return (
    <span className="avatar avatar--letter" style={style} aria-hidden="true">
      {(handle[0] ?? "?").toUpperCase()}
    </span>
  );
}
