// server.js - 使用Express和EJS实现服务器端渲染

const express = require('express');
const path = require('path');
const compression = require('compression');
const fs = require('fs');
const ejs = require('ejs');
const { minify } = require('html-minifier');
const app = express();
const PORT = process.env.PORT || 3000;

// 启用压缩中间件
app.use(compression());

// 设置EJS为模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静态文件服务
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
  maxAge: '7d',
  immutable: true
}));
app.use('/js', express.static(path.join(__dirname, 'public/js'), {
  maxAge: '7d',
  immutable: true
}));
app.use('/images', express.static(path.join(__dirname, 'public/images'), {
  maxAge: '30d',
  immutable: true
}));

// 缓存常用数据
const featuresData = JSON.parse(fs.readFileSync('./data/features.json', 'utf8'));
const tipsData = JSON.parse(fs.readFileSync('./data/tips.json', 'utf8'));
const blogPostsData = JSON.parse(fs.readFileSync('./data/blog-posts.json', 'utf8'));

// HTML压缩选项
const minifyOptions = {
  removeComments: true,
  collapseWhitespace: true,
  minifyJS: true,
  minifyCSS: true
};

// 设置内存缓存
const pageCache = new Map();
const CACHE_DURATION = 3600000; // 缓存1小时

// 缓存中间件
function cacheMiddleware(req, res, next) {
  const key = req.originalUrl;
  const cachedPage = pageCache.get(key);
  
  if (cachedPage && Date.now() - cachedPage.timestamp < CACHE_DURATION) {
    return res.send(cachedPage.content);
  }
  
  // 保存原始send方法
  const originalSend = res.send;
  
  // 重写send方法以缓存响应
  res.send = function(body) {
    // 仅缓存HTML响应
    if (res.get('Content-Type') && res.get('Content-Type').includes('text/html')) {
      pageCache.set(key, {
        content: body,
        timestamp: Date.now()
      });
    }
    
    // 调用原始方法
    originalSend.call(this, body);
  };
  
  next();
}

// 主页路由
app.get('/', cacheMiddleware, (req, res) => {
  res.render('index', {
    features: featuresData.slice(0, 6), // 获取前6个特性
    tips: tipsData.slice(0, 3), // 获取前3个技巧
    recentPosts: blogPostsData.slice(0, 3) // 获取前3篇博客文章
  }, (err, html) => {
    if (err) return res.status(500).send('服务器错误');
    
    // 压缩HTML
    const minifiedHtml = minify(html, minifyOptions);
    res.send(minifiedHtml);
  });
});

// 博客页面路由
app.get('/blog/', cacheMiddleware, (req, res) => {
  res.render('blog', {
    posts: blogPostsData,
    featured: blogPostsData[0] // 设置第一篇为特色文章
  }, (err, html) => {
    if (err) return res.status(500).send('服务器错误');
    res.send(minify(html, minifyOptions));
  });
});

// 博客文章页面路由
app.get('/blog/:slug', cacheMiddleware, (req, res) => {
  const post = blogPostsData.find(post => post.slug === req.params.slug);
  
  if (!post) {
    return res.status(404).render('404');
  }
  
  // 查找相关文章
  const relatedPosts = blogPostsData
    .filter(p => p.slug !== post.slug && p.categories.some(cat => post.categories.includes(cat)))
    .slice(0, 3);
  
  res.render('blog-post', {
    post,
    relatedPosts
  }, (err, html) => {
    if (err) return res.status(500).send('服务器错误');
    res.send(minify(html, minifyOptions));
  });
});

// Tips and Strategies页面路由
app.get('/tips-and-strategies/', cacheMiddleware, (req, res) => {
  res.render('tips', {
    tips: tipsData
  }, (err, html) => {
    if (err) return res.status(500).send('服务器错误');
    res.send(minify(html, minifyOptions));
  });
});

// Tips详情页面路由
app.get('/tips-and-strategies/:slug', cacheMiddleware, (req, res) => {
  const tip = tipsData.find(tip => tip.slug === req.params.slug);
  
  if (!tip) {
    return res.status(404).render('404');
  }
  
  res.render('tip-detail', {
    tip,
    relatedTips: tipsData.filter(t => t.slug !== tip.slug).slice(0, 3)
  }, (err, html) => {
    if (err) return res.status(500).send('服务器错误');
    res.send(minify(html, minifyOptions));
  });
});

// 游戏模式页面路由
app.get('/game-modes/', cacheMiddleware, (req, res) => {
  const gameModes = JSON.parse(fs.readFileSync('./data/game-modes.json', 'utf8'));
  
  res.render('game-modes', {
    gameModes
  }, (err, html) => {
    if (err) return res.status(500).send('服务器错误');
    res.send(minify(html, minifyOptions));
  });
});

// 添加sitemap.xml路由
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://railhunt.org';
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // 添加主页
  sitemap += `  <url>\n    <loc>${baseUrl}/</loc>\n    <priority>1.0</priority>\n  </url>\n`;
  
  // 添加博客页面
  sitemap += `  <url>\n    <loc>${baseUrl}/blog/</loc>\n    <priority>0.8</priority>\n  </url>\n`;
  
  // 添加博客文章
  blogPostsData.forEach(post => {
    sitemap += `  <url>\n    <loc>${baseUrl}/blog/${post.slug}</loc>\n    <lastmod>${post.date}</lastmod>\n    <priority>0.7</priority>\n  </url>\n`;
  });
  
  // 添加技巧页面
  sitemap += `  <url>\n    <loc>${baseUrl}/tips-and-strategies/</loc>\n    <priority>0.8</priority>\n  </url>\n`;
  
  // 添加技巧详情页面
  tipsData.forEach(tip => {
    sitemap += `  <url>\n    <loc>${baseUrl}/tips-and-strategies/${tip.slug}</loc>\n    <priority>0.7</priority>\n  </url>\n`;
  });
  
  // 添加游戏模式页面
  sitemap += `  <url>\n    <loc>${baseUrl}/game-modes/</loc>\n    <priority>0.8</priority>\n  </url>\n`;
  
  sitemap += '</urlset>';
  
  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});

// 添加robots.txt路由
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Sitemap: https://railhunt.org/sitemap.xml`);
});

// 404错误处理
app.use((req, res) => {
  res.status(404).render('404');
});

// 服务器错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500');
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
