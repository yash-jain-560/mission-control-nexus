#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { AgentStatusCommand } from './commands/agent-status';
import { TicketCommand } from './commands/ticket';
import { ActivityCommand } from './commands/activity';
import { MissionControlService } from './services/mission-control';
import { Logger } from './utils/logger';

class MissionControlNexus {
  private program: Command;
  private logger: Logger;
  private service: MissionControlService;

  constructor() {
    this.program = new Command();
    this.logger = new Logger();
    this.service = new MissionControlService();
    
    this.setupProgram();
    this.setupCommands();
  }

  private setupProgram(): void {
    this.program
      .name('mcn')
      .description('Mission Control Nexus - CLI for agent monitoring and management')
      .version('1.0.0')
      .hook('preAction', () => {
        this.displayBanner();
      });

    // Global options
    this.program
      .option('-v, --verbose', 'enable verbose logging')
      .option('-q, --quiet', 'suppress output')
      .option('--config <path>', 'path to configuration file')
      .hook('preAction', (thisCommand, actionCommand) => {
        const options = thisCommand.opts();
        if (options.verbose) {
          this.logger.setLevel('debug');
        }
        if (options.quiet) {
          this.logger.setLevel('error');
        }
      });
  }

  private setupCommands(): void {
    // Agent status command
    this.program.addCommand(new AgentStatusCommand(this.service, this.logger).getCommand());

    // Ticket management command
    this.program.addCommand(new TicketCommand(this.service, this.logger).getCommand());

    // Activity logging command
    this.program.addCommand(new ActivityCommand(this.service, this.logger).getCommand());

    // Help command override
    this.program.helpOption('-h, --help', 'display help for command');
    this.program.helpCommand(false);
  }

  private displayBanner(): void {
    const banner = figlet.textSync('Mission Control Nexus', {
      font: 'Small',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true
    });

    console.log(chalk.cyan(banner));
    console.log(chalk.gray('Agent Status Monitoring • Ticket Management • Activity Logging'));
    console.log('');
  }

  public async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      this.logger.error('Application error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// Run the application
const app = new MissionControlNexus();
app.run().catch((error) => {
  console.error('Failed to start Mission Control Nexus:', error);
  process.exit(1);
});