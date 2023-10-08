#!/bin/sh

rm -rf result
nix build '.#'
