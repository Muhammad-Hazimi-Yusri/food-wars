export default function TestPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Color Palette Test</h1>
      
      {/* Fonts */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Fonts</h2>
        <p className="font-display text-2xl mb-2">
          Dela Gothic One — 食戟 Headers
        </p>
        <p className="font-body text-lg">
          Zen Kaku Gothic — Body text for readability
        </p>
      </section>

      {/* Soma */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Soma (Primary Actions)</h2>
        <div className="flex gap-2">
          <div className="w-24 h-16 bg-soma-dark rounded flex items-center justify-center text-white text-xs">dark</div>
          <div className="w-24 h-16 bg-soma rounded flex items-center justify-center text-white text-xs">default</div>
          <div className="w-24 h-16 bg-soma-light rounded flex items-center justify-center text-white text-xs">light</div>
        </div>
      </section>

      {/* Megumi */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Megumi (Headers/Backgrounds)</h2>
        <div className="flex gap-2">
          <div className="w-24 h-16 bg-megumi-dark rounded flex items-center justify-center text-white text-xs">dark</div>
          <div className="w-24 h-16 bg-megumi rounded flex items-center justify-center text-white text-xs">default</div>
          <div className="w-24 h-16 bg-megumi-light rounded flex items-center justify-center text-white text-xs">light</div>
        </div>
      </section>

      {/* Hayama */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Hayama (Light Backgrounds)</h2>
        <div className="flex gap-2">
          <div className="w-24 h-16 bg-hayama-dark rounded flex items-center justify-center text-megumi text-xs border">dark</div>
          <div className="w-24 h-16 bg-hayama rounded flex items-center justify-center text-megumi text-xs border">default</div>
          <div className="w-24 h-16 bg-hayama-light rounded flex items-center justify-center text-megumi text-xs border">light</div>
        </div>
      </section>

      {/* Takumi */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Takumi (Warnings/Expiring)</h2>
        <div className="flex gap-2">
          <div className="w-24 h-16 bg-takumi-dark rounded flex items-center justify-center text-white text-xs">dark</div>
          <div className="w-24 h-16 bg-takumi rounded flex items-center justify-center text-megumi-dark text-xs">default</div>
          <div className="w-24 h-16 bg-takumi-light rounded flex items-center justify-center text-megumi-dark text-xs">light</div>
        </div>
      </section>

      {/* Kurokiba */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Kurokiba (Danger/Expired)</h2>
        <div className="flex gap-2">
          <div className="w-24 h-16 bg-kurokiba-dark rounded flex items-center justify-center text-white text-xs">dark</div>
          <div className="w-24 h-16 bg-kurokiba rounded flex items-center justify-center text-white text-xs">default</div>
          <div className="w-24 h-16 bg-kurokiba-light rounded flex items-center justify-center text-white text-xs">light</div>
        </div>
      </section>

      {/* Hisako */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Hisako (Highlights/Selected)</h2>
        <div className="flex gap-2">
          <div className="w-24 h-16 bg-hisako-dark rounded flex items-center justify-center text-megumi-dark text-xs">dark</div>
          <div className="w-24 h-16 bg-hisako rounded flex items-center justify-center text-megumi-dark text-xs">default</div>
          <div className="w-24 h-16 bg-hisako-light rounded flex items-center justify-center text-megumi-dark text-xs">light</div>
        </div>
      </section>

      {/* Button examples */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Button Examples</h2>
        <div className="flex gap-4">
          <button className="bg-soma hover:bg-soma-light text-white px-4 py-2 rounded">Primary</button>
          <button className="bg-takumi hover:bg-takumi-light text-megumi-dark px-4 py-2 rounded">Warning</button>
          <button className="bg-kurokiba hover:bg-kurokiba-light text-white px-4 py-2 rounded">Danger</button>
        </div>
      </section>
    </main>
  );
}