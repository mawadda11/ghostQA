import { seedGhostShop } from "./seed-ghostshop.js";

const seeded = await seedGhostShop();
console.log("GhostShop persistence seed");
console.log(`Project: ${seeded.project.id}`);
console.log(`Flow: ${seeded.flow.id}`);
console.log(`Scenarios: ${seeded.scenarios.length}`);
