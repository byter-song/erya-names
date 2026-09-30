export function OnboardingProgress({ current, total }: { current: number; total: number }) {
  return (
    <div aria-label={`第 ${current} 步，共 ${total} 步`} className="onboarding-progress">
      <span>
        第 {current} 步，共 {total} 步
      </span>
      <div aria-hidden="true" className="onboarding-progress__track">
        <span style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}
