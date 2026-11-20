import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render both faces of the card', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const faces = Array.from(compiled.querySelectorAll<HTMLImageElement>('.card .face img'));
    expect(faces.map((img) => img.getAttribute('src'))).toEqual(['card/front.webp', 'card/back.webp']);
    expect(compiled.querySelectorAll('.card .edge').length).toBeGreaterThan(0);
  });
});
