# nix/sources.nix
{
  nixpkgs = import (fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/60e405b241ed.tar.gz";
    sha256 = "0d6sdvj5s57s0nkv4wc7bh4hv7w1v0h4p2jhbzdic2s1swfkilsb";
  }) {};
}
