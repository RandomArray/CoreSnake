
export enum GameMode {
  AI_WATCH = 'AI_WATCH',
  TRAINING = 'TRAINING'
}

export enum ItemType {
  FOOD = 'FOOD',
  GOLD = 'GOLD',
  SCISSORS = 'SCISSORS',
  ICE = 'ICE'
}

export type Point = {
  x: number;
  y: number;
};

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface VisionData {
  direction: Point;
  dist: number;
  foodFound: boolean;
  itemFound?: ItemType;
  itemDist?: number; // Added to track distance to special items
  bodyFound: boolean;
  wallFound: boolean;
  point: Point;
}

export interface SpecialItem {
  point: Point;
  type: ItemType;
  expires: number; // Step count when it disappears
}

export interface GameState {
  snake: Point[];
  food: Point;
  specialItems: SpecialItem[];
  walls: Point[];
  score: number;
  level: number;
  itemsCollectedInLevel: number;
  isGameOver: boolean;
  steps: number;
  slowEffectSteps: number;
  portalOpen: boolean;
  portalPoint: Point | null;
}

export interface QLearningStats {
  episodes: number;
  epsilon: number;
  totalReward: number;
  qTableSize: number;
  bestScoreEver: number;
  avgScoreLast100: number;
  currentLevel: number;
  totalStepsEver: number;
  levelSuccessRate: number;
  scoreHistory: number[]; // For charts
  epsilonHistory: number[]; // For charts
}
