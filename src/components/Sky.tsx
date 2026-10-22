export default function Sky() {
  return <div className="sky" aria-hidden="true">
    <div className="aurora aurora-one" /><div className="aurora aurora-two" />
    {Array.from({ length: 44 }, (_, i) => <i className="sky-star" key={i} style={{ left: `${(i * 37.39 + 11) % 100}%`, top: `${(i * 21.79 + 3) % 100}%`, width: i % 6 === 0 ? 3 : 2, height: i % 6 === 0 ? 3 : 2, animationDelay: `${i % 9}s`, animationDuration: `${4 + i % 5}s` }} />)}
    <span className="shooting-star" /><span className="shooting-star shooting-star-two" />
  </div>
}
