import Image from "next/image";

type Props = {
  className?: string;
  priority?: boolean;
};

/** Site mark — `object-contain` keeps aspect ratio inside fixed header rows. */
export function BrandLogo({ className = "h-12 w-auto max-w-full object-contain object-left", priority }: Props) {
  return (
    <Image
      src="/logo.png"
      alt="Playscript"
      width={220}
      height={56}
      className={className}
      priority={priority}
    />
  );
}
