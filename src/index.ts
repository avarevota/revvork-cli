import { Command } from 'commander';

const program = new Command();
program
  .name('revvork')
  .description('CLI for the Revvork project-management app')
  .version('0.1.0');

program.parseAsync(process.argv);
