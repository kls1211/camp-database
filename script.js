async function search() {
  const location = document.getElementById("location").value;
  const temperature = parseFloat(document.getElementById("temperature").value);
  const type = document.getElementById("type").value;

  const response = await fetch("data/campsites.json");
  const campsites = await response.json();

  const filtered = campsites.filter(site => {
    return (!location || site.location.includes(location)) &&
           (!temperature || site.avg_temp == temperature) &&
           (!type || site.type === type);
  });

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";
  if (filtered.length === 0) {
    resultsDiv.innerHTML = "<p>該当するキャンプ場が見つかりませんでした。</p>";
  } else {
    filtered.forEach(site => {
      const div = document.createElement("div");
      div.className = "result-card";
      div.innerHTML = `
        <h3>${site.name}</h3>
        <p>場所: ${site.location}</p>
        <p>形態: ${site.type}</p>
        <p>平均気温: ${site.avg_temp}℃</p>
        <a href="${site.website}" target="_blank">公式サイト</a> | 
        <a href="${site.map}" target="_blank">GoogleMap</a>
      `;
      resultsDiv.appendChild(div);
    });
  }
}