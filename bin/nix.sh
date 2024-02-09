#!/bin/sh

rm -rf result
nix build '.#' --extra-experimental-features nix-command --extra-experimental-features flakes
