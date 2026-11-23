// The size of the portrait's turn. The frames, made from the owner's own video with their permission, are in
// /hero-donus.bin: all dark-page frames, then all light-page frames, 1 bit per cell, row-major, most significant bit first.
// The video itself is not in the app.
export const HERO = Object.freeze({ width: 120, height: 112, frames: 96, fadeRows: 16 });
