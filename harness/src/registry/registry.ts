import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SkillDefinition } from "./types.js";

/**
 * Loads and serves skill definitions. Skills install as folders of data
 * (skill.json + SKILL.md) so a new skill or a sharper prompt ships as a new
 * registry version with no harness deploy (delivery-roadmap: skills = config).
 */
export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  constructor(skills: SkillDefinition[] = []) {
    for (const s of skills) this.register(s);
  }

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): SkillDefinition {
    const skill = this.skills.get(name);
    if (!skill) throw new Error(`Skill "${name}" not found in registry`);
    return skill;
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  static loadFromDir(dir: string): SkillRegistry {
    const registry = new SkillRegistry();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const metaPath = join(dir, entry.name, "skill.json");
      if (!existsSync(metaPath)) continue;
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      const promptPath = join(dir, entry.name, "SKILL.md");
      const prompt = existsSync(promptPath) ? readFileSync(promptPath, "utf8") : "";
      registry.register({ ...meta, prompt });
    }
    return registry;
  }
}
