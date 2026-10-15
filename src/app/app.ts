import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AssistantPanel } from './assistant/assistant-panel';
import { Header } from './layout/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, AssistantPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header />
    <main id="main">
      <router-outlet />
    </main>
    <app-assistant-panel />
  `,
})
export class App {}
