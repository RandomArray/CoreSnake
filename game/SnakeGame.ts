
import { Point, Direction, GameState, VisionData, ItemType, SpecialItem } from '../types';

export const GRID_SIZE = 30;
const LEVEL_GOAL = 10;

export class SnakeGame {
  state: GameState;
  private maxSteps: number = 3000;
  // Performance optimization: 2D array for fast wall/obstacle lookups
  private wallMap: boolean[][];

  constructor(level: number = 1) {
    this.wallMap = Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(false));
    this.state = this.getInitialState(level);
    this.updateWallMap();
  }

  getInitialState(level: number): GameState {
    const snake = [{ x: 15, y: 15 }, { x: 15, y: 16 }, { x: 15, y: 17 }];
    const walls = this.getLevelWalls(level);
    return {
      snake,
      food: { x: 0, y: 0 }, // Placeholder, set below
      specialItems: [],
      walls,
      score: 0,
      level,
      itemsCollectedInLevel: 0,
      isGameOver: false,
      steps: 0,
      slowEffectSteps: 0,
      portalOpen: false,
      portalPoint: null
    };
  }

  public isPointWall(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return true;
    return this.wallMap[y][x];
  }

  private updateWallMap() {
    for (let y = 0; y < GRID_SIZE; y++) this.wallMap[y].fill(false);
    this.state.walls.forEach(w => {
      if (w.x >= 0 && w.x < GRID_SIZE && w.y >= 0 && w.y < GRID_SIZE) {
        this.wallMap[w.y][w.x] = true;
      }
    });
    // Set initial food now that wallMap is ready
    this.state.food = this.getRandomEmptyPoint(this.state.snake, this.state.walls);
  }

  private getLevelWalls(level: number): Point[] {
    const walls: Point[] = [];
    if (level === 2) {
      for (let i = 10; i < 20; i++) {
        walls.push({ x: i, y: 10 }, { x: i, y: 20 });
        if (i > 10 && i < 20 && i !== 15) {
           walls.push({ x: 10, y: i }, { x: 20, y: i });
        }
      }
    } else if (level === 3) {
      for (let i = 0; i < 12; i++) {
        walls.push({ x: 15, y: i });
        walls.push({ x: 15, y: GRID_SIZE - i - 1 });
        walls.push({ x: i, y: 15 });
        walls.push({ x: GRID_SIZE - i - 1, y: 15 });
      }
    } else if (level >= 4) {
      // Improved procedural walls: Iterate every cell, use a better hash-like function
      const seed = level * 1.618; // Use golden ratio to avoid periodic patterns
      const maxDensity = 0.15; // Cap density to keep the board traversable
      const density = Math.min(maxDensity, 0.05 + (level * 0.0001)); 
      
      for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
          // Skip the center spawning area
          if (Math.abs(i - 15) < 3 && Math.abs(j - 15) < 3) continue;
          
          const val = Math.abs(Math.sin(seed + i * 12.9898 + j * 78.233) * 43758.5453) % 1;
          if (val < density) {
            walls.push({ x: i, y: j });
          }
        }
      }
    }
    return walls;
  }

  private getRandomEmptyPoint(snake: Point[], walls: Point[], otherItems: SpecialItem[] = []): Point {
    let p: Point;
    let attempts = 0;
    while (attempts < 500) {
      p = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      if (this.wallMap[p.y][p.x]) { attempts++; continue; }
      const hitSnake = snake.some(s => s.x === p.x && s.y === p.y);
      if (hitSnake) { attempts++; continue; }
      const hitItems = otherItems.some(i => i.point.x === p.x && i.point.y === p.y);
      if (hitItems) { attempts++; continue; }
      return p;
    }
    return { x: 0, y: 0 }; 
  }

  public getVisionExtended(): VisionData[] {
    const head = this.state.snake[0];
    const neck = this.state.snake[1];
    
    // Standard 8 directions
    const rayDirs: Point[] = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
    ];

    // Determine current heading
    let forward: Point = { x: 0, y: -1 };
    if (neck) {
      forward = { x: head.x - neck.x, y: head.y - neck.y };
    }

    const target = this.state.portalOpen && this.state.portalPoint ? this.state.portalPoint : this.state.food;

    return rayDirs.map(dir => {
      let curr = { x: head.x + dir.x, y: head.y + dir.y };
      let dist = 1;
      let foodFound = false;
      let bodyFound = false;
      let wallFound = false;
      let itemFound: ItemType | undefined = undefined;
      let itemDist: number | undefined = undefined;
      let point = { ...curr };

      while (curr.x >= 0 && curr.x < GRID_SIZE && curr.y >= 0 && curr.y < GRID_SIZE) {
        point = { ...curr };
        
        if (!foodFound && curr.x === target.x && curr.y === target.y) {
          foodFound = true;
        }

        // Detect Special Items
        const specialItem = this.state.specialItems.find(si => si.point.x === curr.x && si.point.y === curr.y);
        if (specialItem && !itemFound) {
          itemFound = specialItem.type;
          itemDist = dist;
        }

        if (this.state.snake.some(p => p.x === curr.x && p.y === curr.y)) {
          bodyFound = true;
          break;
        }

        if (this.wallMap[curr.y][curr.x]) {
          wallFound = true;
          break;
        }

        curr.x += dir.x;
        curr.y += dir.y;
        dist++;
      }

      if (!wallFound && (curr.x < 0 || curr.x >= GRID_SIZE || curr.y < 0 || curr.y >= GRID_SIZE)) {
        wallFound = true;
      }

      return {
        direction: dir,
        dist,
        foodFound,
        itemFound,
        itemDist,
        bodyFound,
        wallFound,
        point
      };
    });
  }

  step(direction: Direction): number {
    if (this.state.isGameOver) return -20;

    this.state.steps++;
    if (this.state.slowEffectSteps > 0) this.state.slowEffectSteps--;

    const head = { ...this.state.snake[0] };
    switch (direction) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Death check
    if (
      head.x < 0 || head.x >= GRID_SIZE || 
      head.y < 0 || head.y >= GRID_SIZE ||
      this.wallMap[head.y][head.x] ||
      this.state.snake.some(p => p.x === head.x && p.y === head.y) ||
      this.state.steps > this.maxSteps + this.state.score * 50
    ) {
      this.state.isGameOver = true;
      return -100;
    }

    if (this.state.portalOpen && this.state.portalPoint && head.x === this.state.portalPoint.x && head.y === this.state.portalPoint.y) {
      this.advanceLevel();
      return 250;
    }

    const newSnake = [head, ...this.state.snake];
    let reward = -0.05; // Slightly lower step penalty

    let pickedItemIndex = -1;
    for (let i = 0; i < this.state.specialItems.length; i++) {
        const si = this.state.specialItems[i];
        if (si.point.x === head.x && si.point.y === head.y) {
            pickedItemIndex = i;
            break;
        }
    }

    if (pickedItemIndex !== -1) {
      const item = this.state.specialItems[pickedItemIndex];
      this.state.specialItems.splice(pickedItemIndex, 1);
      switch (item.type) {
        case ItemType.GOLD: this.state.score += 15; reward = 60; break;
        case ItemType.SCISSORS:
          this.state.score += 5; reward = 40;
          const reduceAmount = Math.max(0, newSnake.length - 5);
          for (let k = 0; k < Math.min(3, reduceAmount); k++) newSnake.pop();
          break;
        case ItemType.ICE: this.state.score += 2; this.state.slowEffectSteps = 20; reward = 15; break;
      }
    }

    if (head.x === this.state.food.x && head.y === this.state.food.y) {
      this.state.score += 1;
      this.state.itemsCollectedInLevel++;
      reward = 30; // Better food reward
      if (this.state.itemsCollectedInLevel >= LEVEL_GOAL && !this.state.portalOpen) {
        this.state.portalOpen = true;
        this.state.portalPoint = this.getRandomEmptyPoint(newSnake, this.state.walls, this.state.specialItems);
      }
      this.state.food = this.getRandomEmptyPoint(newSnake, this.state.walls, this.state.specialItems);
    } else {
      newSnake.pop();
    }

    if (this.state.steps % 75 === 0 && Math.random() < 0.3 && this.state.specialItems.length < 3) {
      const types = [ItemType.GOLD, ItemType.SCISSORS, ItemType.ICE];
      const type = types[Math.floor(Math.random() * types.length)];
      this.state.specialItems.push({
        type,
        point: this.getRandomEmptyPoint(newSnake, this.state.walls, this.state.specialItems),
        expires: this.state.steps + 150
      });
    }

    this.state.specialItems = this.state.specialItems.filter(i => i.expires > this.state.steps);
    this.state.snake = newSnake;
    return reward;
  }

  private advanceLevel() {
    this.state.level++;
    this.state.itemsCollectedInLevel = 0;
    this.state.portalOpen = false;
    this.state.portalPoint = null;
    this.state.walls = this.getLevelWalls(this.state.level);
    this.state.specialItems = [];
    this.state.steps = 0;
    this.state.snake = [{ x: 15, y: 15 }, { x: 15, y: 16 }, { x: 15, y: 17 }];
    this.updateWallMap(); 
  }
}
