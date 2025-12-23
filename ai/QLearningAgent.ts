
import { SnakeGame, GRID_SIZE } from '../game/SnakeGame';
import { Direction } from '../types';

export class QLearningAgent {
  qTable: Map<string, number[]>;
  alpha: number = 0.25; 
  gamma: number = 0.95; 
  epsilon: number = 1.0; 
  epsilonMin: number = 0.01;
  epsilonDecay: number = 0.999997; // Slower decay for better long-term exploration
  
  game: SnakeGame;
  totalReward: number = 0;
  totalStepsEver: number = 0;
  
  constructor() {
    this.qTable = new Map();
    this.game = new SnakeGame();
    this.loadFromStorage();
  }

  getStateString(): string {
    const head = this.game.state.snake[0];
    const food = this.game.state.food;
    const snake = this.game.state.snake;
    const target = this.game.state.portalOpen ? this.game.state.portalPoint! : food;

    // 1. Target relative position
    const tX = target.x < head.x ? "L" : target.x > head.x ? "R" : "C";
    const tY = target.y < head.y ? "U" : target.y > head.y ? "D" : "C";

    // 2. Obstacle Sensing (1-step and 2-step lookahead)
    const isBlocking = (x: number, y: number) => {
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return true;
      if (this.game.isPointWall(x, y)) return true;
      // Faster snake collision check (only if board is not huge)
      for(let i = 0; i < snake.length; i++) {
        if (snake[i].x === x && snake[i].y === y) return true;
      }
      return false;
    };

    const dU = isBlocking(head.x, head.y - 1) ? "1" : "0";
    const dD = isBlocking(head.x, head.y + 1) ? "1" : "0";
    const dL = isBlocking(head.x - 1, head.y) ? "1" : "0";
    const dR = isBlocking(head.x + 1, head.y) ? "1" : "0";

    const dU2 = isBlocking(head.x, head.y - 2) ? "1" : "0";
    const dD2 = isBlocking(head.x, head.y + 2) ? "1" : "0";
    const dL2 = isBlocking(head.x - 2, head.y) ? "1" : "0";
    const dR2 = isBlocking(head.x + 2, head.y) ? "1" : "0";

    let heading = "N";
    if (snake.length > 1) {
      const neck = snake[1];
      if (head.x > neck.x) heading = "R";
      else if (head.x < neck.x) heading = "L";
      else if (head.y > neck.y) heading = "D";
      else if (head.y < neck.y) heading = "U";
    }

    return `${tX}${tY}${dU}${dD}${dL}${dR}${dU2}${dD2}${dL2}${dR2}${heading}`;
  }

  getQValues(state: string): number[] {
    let q = this.qTable.get(state);
    if (!q) {
      q = [0, 0, 0, 0];
      this.qTable.set(state, q); 
    }
    return q;
  }

  getCurrentStateQValues(): number[] {
    return this.getQValues(this.getStateString());
  }

  chooseAction(state: string): number {
    if (Math.random() < this.epsilon) return Math.floor(Math.random() * 4);
    
    const qValues = this.getQValues(state);
    let maxIdx = 0;
    let maxVal = qValues[0];
    for (let i = 1; i < 4; i++) {
      if (qValues[i] > maxVal) { maxVal = qValues[i]; maxIdx = i; }
    }
    return maxIdx;
  }

  update(): void {
    if (this.game.state.isGameOver) return;

    const state = this.getStateString();
    const headBefore = { ...this.game.state.snake[0] };
    const target = this.game.state.portalOpen ? this.game.state.portalPoint! : this.game.state.food;
    const distBefore = Math.abs(headBefore.x - target.x) + Math.abs(headBefore.y - target.y);

    const action = this.chooseAction(state);
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    let reward = this.game.step(directions[action]);
    
    // Proximity Reward Shaping (Manhattan Distance)
    if (!this.game.state.isGameOver) {
      const headAfter = this.game.state.snake[0];
      const distAfter = Math.abs(headAfter.x - target.x) + Math.abs(headAfter.y - target.y);
      if (distAfter < distBefore) reward += 0.8; // Encouragement
      else if (distAfter > distBefore) reward -= 0.8; // Discouragement
    }

    this.totalReward += reward;
    this.totalStepsEver++;

    const nextState = this.getStateString();
    const nextQValues = this.getQValues(nextState);
    const maxNextQ = Math.max(...nextQValues);

    const currentQValues = this.getQValues(state);
    currentQValues[action] += this.alpha * (reward + this.gamma * (this.game.state.isGameOver ? 0 : maxNextQ) - currentQValues[action]);

    if (this.epsilon > this.epsilonMin) this.epsilon *= this.epsilonDecay;
  }

  saveToStorage(): void {
    const tableObj = Object.fromEntries(this.qTable);
    localStorage.setItem('qs_v6_qtable', JSON.stringify(tableObj));
    localStorage.setItem('qs_v6_epsilon', this.epsilon.toString());
    localStorage.setItem('qs_v6_steps', this.totalStepsEver.toString());
  }

  loadFromStorage(): void {
    const savedTable = localStorage.getItem('qs_v6_qtable');
    const savedEpsilon = localStorage.getItem('qs_v6_epsilon');
    const savedSteps = localStorage.getItem('qs_v6_steps');
    if (savedTable) {
      try {
        const obj = JSON.parse(savedTable);
        this.qTable = new Map(Object.entries(obj) as [string, number[]][]);
      } catch (e) { console.error("Failed to load QTable", e); }
    }
    if (savedEpsilon) this.epsilon = parseFloat(savedEpsilon);
    if (savedSteps) this.totalStepsEver = parseInt(savedSteps, 10);
  }

  reset(): void {
    this.game = new SnakeGame(this.game.state.level); 
    this.totalReward = 0;
  }
}
