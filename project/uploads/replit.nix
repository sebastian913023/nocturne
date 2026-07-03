# replit.nix — system dependencies (fallback to the .replit `modules` line)
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
  ];
}
