import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const README_PATH = path.join(ROOT_DIR, 'README.md');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

const GITHUB_USERNAME = 'oharato';
const MAX_REPOS = 14;

const EMOJI_MAP = {
    'databricks': '📊',
    'world-paintings-learning': '🎨',
    'hundred-cells': '💯',
    'classic-music-learning': '🎵',
    'world-flags-learning': '🌍',
    'item-manage': '📦',
    'edinet-ts': '📈',
    'stock-analyze-old': '📈',
    'tachibana-ts': '💹',
    'backlog-duckdb-mcp': '📝',
    'presentation_maker': '🎤',
    'e-book-list': '📚',
    'env-marker': '🔖',
    'minted-directory': '📁'
};

async function getRepos() {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&direction=desc&per_page=30`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch repos: ${res.statusText}`);
    const repos = await res.json();
    return repos.filter(repo => !repo.is_template && repo.name !== GITHUB_USERNAME);
}

async function getReadmeDescription(repoName) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}/readme`;
    const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3.raw' } });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('[') && !trimmed.startsWith('=')) {
            return trimmed;
        }
    }
    return null;
}

async function takeScreenshot(url, filepath) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({ path: filepath });
    } finally {
        await browser.close();
    }
}

async function updatePortfolio() {
    await fs.mkdir(ASSETS_DIR, { recursive: true });

    const repos = await getRepos();
    const selectedRepos = repos.slice(0, Math.min(repos.length, MAX_REPOS));

    let markdown = '## 💼 Portfolio\n更新日が新しい順に、開発した主なアプリ・プロジェクトを掲載しています。\n\n';

    for (const repo of selectedRepos) {
        console.log(`Processing repo: ${repo.name}`);

        let description = repo.description;
        if (!description) {
            console.log(`  Fetching README for description...`);
            description = await getReadmeDescription(repo.name);
        }
        description = description ? description.replace(/[\r\n]+/g, ' ').substring(0, 150) : '(概要なし)';

        let appUrlStr = '(なし)';
        let screenshotStr = '';

        const homepage = repo.homepage || (repo.name === 'world-flags-learning' ? 'https://world-flags-learning.ohchans.com' :
            (repo.name === 'env-marker' ? 'https://chromewebstore.google.com/detail/env-marker/lljeadhgeagbdihjhpdoajpjbpiobmej' :
                (repo.name === 'edinet-ts' ? 'https://www.npmjs.com/package/edinet-ts' : null)));

        if (homepage && homepage.startsWith('http')) {
            appUrlStr = homepage;
            const screenshotPath = path.join(ASSETS_DIR, `${repo.name}.png`);
            const relativeScreenshotPath = `assets/${repo.name}.png`;

            console.log(`  Capturing screenshot from ${homepage}...`);
            try {
                await takeScreenshot(homepage, screenshotPath);
                screenshotStr = `\n  <br><img src="${relativeScreenshotPath}" width="400">`;
            } catch (e) {
                console.error(`  Failed to capture screenshot: ${e.message}`);
            }
        }

        const emoji = EMOJI_MAP[repo.name] || '🚀';

        markdown += `### ${emoji} [${repo.name}](${repo.html_url})\n`;
        markdown += `- **概要**: ${description}\n`;
        markdown += `- **アプリURL**: ${appUrlStr}${screenshotStr}\n`;
        markdown += `- **リポジトリURL**: ${repo.html_url}\n\n`;
    }

    const currentReadme = await fs.readFile(README_PATH, 'utf-8');
    const portfolioStartIndex = currentReadme.indexOf('## 💼 Portfolio');

    let newReadme;
    if (portfolioStartIndex !== -1) {
        newReadme = currentReadme.substring(0, portfolioStartIndex) + markdown.trim() + '\n';
    } else {
        newReadme = currentReadme.trim() + '\n\n' + markdown.trim() + '\n';
    }

    await fs.writeFile(README_PATH, newReadme, 'utf-8');
    console.log('Successfully updated README.md');
}

updatePortfolio().catch(console.error);
