import type { CandidateStage } from "./decision";

export interface DecisionCommand {
  projectId: string;
  candidateId: string;
  from: CandidateStage;
  to: CandidateStage;
}

export class SessionUndoStack {
  private readonly commands: DecisionCommand[] = [];

  constructor(private readonly limit = 20) {}

  push(command: DecisionCommand): void {
    this.commands.push(command);
    const projectIndexes = this.commands.flatMap((item, index) =>
      item.projectId === command.projectId ? [index] : [],
    );
    if (projectIndexes.length > this.limit) this.commands.splice(projectIndexes[0]!, 1);
  }

  pop(projectId: string): DecisionCommand | undefined {
    let index = -1;
    for (let cursor = this.commands.length - 1; cursor >= 0; cursor -= 1) {
      if (this.commands[cursor]?.projectId === projectId) {
        index = cursor;
        break;
      }
    }
    if (index < 0) return undefined;
    const [command] = this.commands.splice(index, 1);
    return command
      ? {
          projectId: command.projectId,
          candidateId: command.candidateId,
          from: command.to,
          to: command.from,
        }
      : undefined;
  }

  hasCommands(projectId: string): boolean {
    return this.commands.some((command) => command.projectId === projectId);
  }
}
