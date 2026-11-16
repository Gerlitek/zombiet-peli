// The whole game uses only these 16 colors. See docs/game-design.md.
export const P = {
  ink: 0x0b0e14, sky: 0x151b2b, cloud: 0x232c44, storm: 0x3a4763, rain: 0x8fa6c4, bone: 0xe7e8ea,
  ice: 0x7cc8f2, iceL: 0xb5e1f8, moss0: 0x16241a, moss1: 0x2c4429, rot: 0x5f8f4a, sick: 0xb4d46a,
  dry: 0x8a7a4a, sand: 0xc9a76a, bark: 0x4a3a2a, hurt: 0xd96b6b,
} as const;

export const css = (color: number) => '#' + color.toString(16).padStart(6, '0');
