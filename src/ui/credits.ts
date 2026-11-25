/** What the game owes and to whom: shown on the Credits screen and summed up on the title screen. */

export const SHORT_DISCLAIMER =
  'Unofficial, non-commercial fan game made for a class · Not affiliated with Coolmath Games, Nintendo or any rights holder';

export const DISCLAIMER = [
  'Coolmath Smash is an unofficial, non-commercial fan game, made for a video game class and shared for free.',
  'It is not affiliated with, endorsed by or sponsored by Coolmath Games, Nintendo, or any of the rights holders named here.',
  'Every character, name and game belongs to its owner. The characters and stages in this game are fan art drawn from scratch; no art or audio is taken from the original games.',
];

export interface CharacterCredit {
  character: string;
  game: string;
  owner: string;
}

/** The roster (handoffs/research/roster.md, developer column), in the order the roster video introduces them. */
export const CHARACTER_CREDITS: CharacterCredit[] = [
  { character: 'Papa Louie', game: 'Papa Louie: When Pizzas Attack!', owner: 'Flipline Studios' },
  { character: 'Fireboy & Watergirl', game: 'Fireboy and Watergirl', owner: 'Oslo Albet' },
  { character: 'Runner', game: 'Run', owner: 'Joseph Cloutier (player_03)' },
  { character: 'Bob the Robber', game: 'Bob the Robber', owner: 'Flazm' },
  { character: 'Snail Bob', game: 'Snail Bob', owner: 'Hunter Hamster' },
  { character: 'Red Ball', game: 'Red Ball', owner: 'Evgeniy Fedoseev (RedBallStudio)' },
  { character: 'The Duck', game: 'Duck Life', owner: 'Wix Games' },
  { character: 'Fluffy', game: 'IQ Ball / Catch the Candy', owner: 'FedoIT' },
  { character: 'Raft Wars kids', game: 'Raft Wars', owner: 'Martijn Kunst (BubbleBox)' },
  { character: 'Bloxorz block', game: 'Bloxorz', owner: 'Damien Clarke (DX Interactive)' },
  { character: 'Johnny Upgrade', game: 'Johnny Upgrade', owner: 'Gameshot' },
  { character: 'Wheely', game: 'Wheely', owner: 'Pegas Games' },
];

export const OTHER_CREDITS: { what: string; owner: string }[] = [
  { what: 'Coolmath Games name, logo and planet', owner: 'Coolmath Games' },
  { what: "The World's Hardest Game (stage)", owner: 'Stephen Critoph (Snubby Land)' },
  { what: 'Super Smash Bros. (gameplay inspiration)', owner: 'Nintendo' },
];

export const CREW_CREDITS: { role: string; who: string }[] = [
  { role: 'Created and directed by', who: 'Krish Garg' },
  {
    role: 'Built with',
    who: 'a crew of Capy AI agents: research, engine and physics, art, menus and HUD, CPU players, audio and music, and one per fighter',
  },
  {
    role: 'Fonts',
    who: 'Lilita One by Juan Montoreano and Nunito by the Nunito Project Authors (SIL Open Font License)',
  },
];
