import UIKit
import WebKit

// AI 提供商数据模型
struct AIProvider {
    let id: String
    let name: String
    let icon: String  // 图标文件名（不含扩展名）
    let url: String
}

// 收藏项数据模型
struct FavoriteItem: Codable {
    let url: String
    let title: String
    let providerName: String
    let dateAdded: Date
}

// 历史记录数据模型
struct HistoryItem: Codable {
    let url: String
    let title: String
    let providerName: String
    let dateVisited: Date
}

class AISidebarViewController: UIViewController {
    
    // MARK: - Properties
    private var providers: [AIProvider] = []
    private var selectedIndex: Int = 0
    private var favorites: [FavoriteItem] = []
    private var history: [HistoryItem] = []
    private var hasLoadedInitialPage = false
    
    // UI Components
    private lazy var sidebarCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumLineSpacing = 4
        layout.minimumInteritemSpacing = 0
        let cv = UICollectionView(frame: .zero, collectionViewLayout: layout)
        cv.backgroundColor = UIColor(red: 0.98, green: 0.98, blue: 0.99, alpha: 1)
        cv.translatesAutoresizingMaskIntoConstraints = false
        cv.showsVerticalScrollIndicator = false
        cv.delegate = self
        cv.dataSource = self
        cv.register(AIProviderCell.self, forCellWithReuseIdentifier: "AIProviderCell")
        
        // 启用拖拽排序
        cv.dragInteractionEnabled = true
        cv.dragDelegate = self
        cv.dropDelegate = self
        
        return cv
    }()
    
    private lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        // 使用持久化数据存储（保持登录状态）
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        
        // 允许 JavaScript
        if #available(iOS 14.0, *) {
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        }
        
        // 处理进程池（共享 cookies）
        configuration.processPool = WKProcessPool()
        
        let wv = WKWebView(frame: .zero, configuration: configuration)
        wv.translatesAutoresizingMaskIntoConstraints = false
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.allowsBackForwardNavigationGestures = true
        
        // 使用完整的 Safari User-Agent
        wv.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        
        return wv
    }()
    
    private lazy var toolbar: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(red: 0.98, green: 0.98, blue: 0.99, alpha: 1)
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var toolbarStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.distribution = .fill
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    private lazy var starButton: UIButton = {
        let btn = createToolbarButton(title: "☆", action: #selector(favoriteTapped), width: 36)
        btn.titleLabel?.font = UIFont.systemFont(ofSize: 18)
        return btn
    }()
    
    private lazy var openInTabButton: UIButton = {
        let btn = createToolbarButton(title: "Open in Tab", action: #selector(openInSafariTapped), width: nil)
        return btn
    }()
    
    private lazy var favoritesButton: UIButton = {
        let btn = createToolbarButton(title: "Favorites", action: #selector(favoritesTapped), width: nil)
        return btn
    }()
    
    private lazy var searchButton: UIButton = {
        let btn = createToolbarButton(title: "Search", action: #selector(searchTapped), width: nil)
        return btn
    }()
    
    private lazy var historyButton: UIButton = {
        let btn = createToolbarButton(title: "History", action: #selector(historyTapped), width: nil)
        return btn
    }()
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupProviders()
        loadProviderOrder()  // 加载保存的顺序
        loadFavorites()      // 加载收藏
        loadHistory()        // 加载历史记录
        setupUI()
        
        // 恢复上次的状态或加载初始页面
        if !restoreLastState() {
            loadInitialProvider()
        }
        hasLoadedInitialPage = true
        
        // 监听 app 进入后台和返回前台
        NotificationCenter.default.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        sidebarCollectionView.collectionViewLayout.invalidateLayout()
    }
    
    // MARK: - Setup
    private func setupProviders() {
        // 与桌面版保持一致的提供商列表和图标
        providers = [
            AIProvider(id: "chatgpt", name: "ChatGPT", icon: "openai", url: "https://chatgpt.com"),
            AIProvider(id: "claude", name: "Claude", icon: "claude", url: "https://claude.ai"),
            AIProvider(id: "gemini", name: "Gemini", icon: "gemini", url: "https://gemini.google.com/app"),
            AIProvider(id: "perplexity", name: "Perplexity", icon: "perplexity", url: "https://www.perplexity.ai"),
            AIProvider(id: "deepseek", name: "DeepSeek", icon: "deepseek", url: "https://chat.deepseek.com"),
            AIProvider(id: "grok", name: "Grok", icon: "grok", url: "https://grok.com"),
            AIProvider(id: "githubcopilot", name: "GitHub Copilot", icon: "githubcopilot", url: "https://github.com/features/copilot"),
            AIProvider(id: "mistral", name: "Mistral", icon: "mistral", url: "https://chat.mistral.ai"),
            AIProvider(id: "cohere", name: "Cohere", icon: "cohere", url: "https://coral.cohere.com"),
            AIProvider(id: "huggingface", name: "HuggingFace", icon: "huggingface", url: "https://huggingface.co/chat"),
            AIProvider(id: "metaai", name: "Meta AI", icon: "metaai", url: "https://www.meta.ai"),
            AIProvider(id: "doubao", name: "豆包", icon: "doubao", url: "https://www.doubao.com"),
            AIProvider(id: "tongyi", name: "通义千问", icon: "tongyi", url: "https://tongyi.aliyun.com"),
            AIProvider(id: "kimi", name: "Kimi", icon: "kimi", url: "https://kimi.moonshot.cn"),
            AIProvider(id: "zhipu", name: "智谱清言", icon: "zhipu", url: "https://chatglm.cn"),
            AIProvider(id: "minimax", name: "海螺AI", icon: "minimax", url: "https://hailuoai.com"),
            AIProvider(id: "notebooklm", name: "NotebookLM", icon: "notebooklm", url: "https://notebooklm.google.com"),
            AIProvider(id: "codex", name: "Codex", icon: "openai", url: "https://chatgpt.com/codex"),
            AIProvider(id: "aistudio", name: "AI Studio", icon: "aistudio", url: "https://aistudio.google.com/apps"),
            AIProvider(id: "genspark", name: "Genspark", icon: "genspark", url: "https://www.genspark.ai"),
            AIProvider(id: "google", name: "Google", icon: "google", url: "https://www.google.com"),
        ]
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.systemBackground
        
        // Add subviews
        view.addSubview(sidebarCollectionView)
        view.addSubview(toolbar)
        view.addSubview(webView)
        
        // Setup toolbar buttons
        toolbar.addSubview(toolbarStack)
        toolbarStack.addArrangedSubview(starButton)
        toolbarStack.addArrangedSubview(openInTabButton)
        toolbarStack.addArrangedSubview(favoritesButton)
        toolbarStack.addArrangedSubview(searchButton)
        toolbarStack.addArrangedSubview(historyButton)
        
        // Layout constraints
        let sidebarWidth: CGFloat = 52
        let toolbarHeight: CGFloat = 44
        
        NSLayoutConstraint.activate([
            // Sidebar
            sidebarCollectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            sidebarCollectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sidebarCollectionView.widthAnchor.constraint(equalToConstant: sidebarWidth),
            sidebarCollectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            // Toolbar
            toolbar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: sidebarCollectionView.trailingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: toolbarHeight),
            
            // Toolbar stack
            toolbarStack.topAnchor.constraint(equalTo: toolbar.topAnchor, constant: 4),
            toolbarStack.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: 8),
            toolbarStack.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor, constant: -8),
            toolbarStack.bottomAnchor.constraint(equalTo: toolbar.bottomAnchor, constant: -4),
            
            // WebView
            webView.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: sidebarCollectionView.trailingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        
        // Add border to sidebar
        sidebarCollectionView.layer.borderWidth = 0.5
        sidebarCollectionView.layer.borderColor = UIColor.separator.cgColor
    }
    
    private func loadInitialProvider() {
        if !providers.isEmpty {
            loadProvider(at: 0)
        }
    }
    
    private func loadProvider(at index: Int) {
        guard index < providers.count else { return }
        selectedIndex = index
        let provider = providers[index]
        if let url = URL(string: provider.url) {
            webView.load(URLRequest(url: url))
        }
        sidebarCollectionView.reloadData()
    }
    
    // MARK: - Helpers
    private func createToolbarButton(title: String, action: Selector, width: CGFloat?) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = UIFont.systemFont(ofSize: 12, weight: .medium)
        btn.setTitleColor(UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1), for: .normal)
        btn.addTarget(self, action: action, for: .touchUpInside)
        btn.layer.cornerRadius = 8
        btn.layer.borderWidth = 1
        btn.layer.borderColor = UIColor(red: 0.9, green: 0.91, blue: 0.92, alpha: 1).cgColor
        btn.backgroundColor = .white
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.contentEdgeInsets = UIEdgeInsets(top: 6, left: 10, bottom: 6, right: 10)
        
        if let w = width {
            btn.widthAnchor.constraint(equalToConstant: w).isActive = true
        }
        
        return btn
    }
    
    // MARK: - Actions
    @objc private func favoriteTapped() {
        guard let url = webView.url?.absoluteString else { return }
        
        // 检查是否已收藏
        if let index = favorites.firstIndex(where: { $0.url == url }) {
            // 取消收藏
            favorites.remove(at: index)
            starButton.setTitle("☆", for: .normal)
            saveFavorites()
        } else {
            // 添加收藏
            let title = webView.title ?? "未命名"
            let providerName = providers[selectedIndex].name
            let item = FavoriteItem(url: url, title: title, providerName: providerName, dateAdded: Date())
            favorites.insert(item, at: 0)
            starButton.setTitle("★", for: .normal)
            saveFavorites()
        }
    }
    
    @objc private func openInSafariTapped() {
        guard let url = webView.url else { return }
        UIApplication.shared.open(url)
    }
    
    @objc private func favoritesTapped() {
        showFavoritesList()
    }
    
    @objc private func searchTapped() {
        showSearchDialog()
    }
    
    @objc private func historyTapped() {
        showHistoryList()
    }
    
    // MARK: - Favorites Functions
    private func showFavoritesList() {
        let alert = UIAlertController(title: "收藏夹", message: nil, preferredStyle: .actionSheet)
        
        if favorites.isEmpty {
            alert.message = "暂无收藏"
        } else {
            for item in favorites.prefix(10) {
                let title = "\(item.providerName): \(item.title)"
                alert.addAction(UIAlertAction(title: title, style: .default) { [weak self] _ in
                    self?.loadFavoriteItem(item)
                })
            }
        }
        
        alert.addAction(UIAlertAction(title: "清空收藏", style: .destructive) { [weak self] _ in
            self?.favorites.removeAll()
            self?.saveFavorites()
            self?.updateStarButton()
        })
        
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        
        if let popover = alert.popoverPresentationController {
            popover.sourceView = favoritesButton
            popover.sourceRect = favoritesButton.bounds
        }
        
        present(alert, animated: true)
    }
    
    private func loadFavoriteItem(_ item: FavoriteItem) {
        if let url = URL(string: item.url) {
            webView.load(URLRequest(url: url))
            addHistoryItem(url: item.url, title: item.title, providerName: item.providerName)
        }
    }
    
    private func saveFavorites() {
        if let data = try? JSONEncoder().encode(favorites) {
            UserDefaults.standard.set(data, forKey: "AIFavorites")
        }
    }
    
    private func loadFavorites() {
        if let data = UserDefaults.standard.data(forKey: "AIFavorites"),
           let saved = try? JSONDecoder().decode([FavoriteItem].self, from: data) {
            favorites = saved
        }
    }
    
    private func updateStarButton() {
        guard let url = webView.url?.absoluteString else {
            starButton.setTitle("☆", for: .normal)
            return
        }
        let isFavorited = favorites.contains { $0.url == url }
        starButton.setTitle(isFavorited ? "★" : "☆", for: .normal)
    }
    
    // MARK: - Search Functions
    private func showSearchDialog() {
        let alert = UIAlertController(title: "搜索", message: "输入关键词在当前 AI 中搜索", preferredStyle: .alert)
        
        alert.addTextField { textField in
            textField.placeholder = "输入搜索关键词..."
            textField.autocapitalizationType = .none
        }
        
        alert.addAction(UIAlertAction(title: "搜索", style: .default) { [weak self] _ in
            guard let keyword = alert.textFields?.first?.text, !keyword.isEmpty else { return }
            self?.performSearch(keyword: keyword)
        })
        
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        
        present(alert, animated: true)
    }
    
    private func performSearch(keyword: String) {
        let provider = providers[selectedIndex]
        let encodedKeyword = keyword.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? keyword
        
        // 根据不同 AI 提供商构建搜索 URL
        var searchURL: String
        
        switch provider.id {
        case "chatgpt":
            searchURL = "https://chatgpt.com/?q=\(encodedKeyword)"
        case "perplexity":
            searchURL = "https://www.perplexity.ai/search?q=\(encodedKeyword)"
        case "gemini":
            searchURL = "https://gemini.google.com/app?q=\(encodedKeyword)"
        case "kimi":
            searchURL = "https://kimi.moonshot.cn/?q=\(encodedKeyword)"
        case "doubao":
            searchURL = "https://www.doubao.com/chat?q=\(encodedKeyword)"
        default:
            // 对于其他 provider，执行页面内搜索
            executeInPageSearch(keyword: keyword)
            return
        }
        
        if let url = URL(string: searchURL) {
            webView.load(URLRequest(url: url))
        }
    }
    
    private func executeInPageSearch(keyword: String) {
        // 使用 JavaScript 进行页面内查找
        let js = """
        (function() {
            var input = document.querySelector('textarea, input[type="text"]');
            if (input) {
                input.value = '\(keyword)';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        })();
        """
        webView.evaluateJavaScript(js) { _, error in
            if let error = error {
                print("[Search] JS error: \(error)")
            }
        }
    }
    
    // MARK: - History Functions
    private func showHistoryList() {
        let alert = UIAlertController(title: "浏览历史", message: nil, preferredStyle: .actionSheet)
        
        if history.isEmpty {
            alert.message = "暂无历史记录"
        } else {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "MM-dd HH:mm"
            
            for item in history.prefix(15) {
                let timeStr = dateFormatter.string(from: item.dateVisited)
                let title = "[\(timeStr)] \(item.providerName): \(item.title)"
                alert.addAction(UIAlertAction(title: title, style: .default) { [weak self] _ in
                    self?.loadHistoryItem(item)
                })
            }
        }
        
        alert.addAction(UIAlertAction(title: "清空历史", style: .destructive) { [weak self] _ in
            self?.history.removeAll()
            self?.saveHistory()
        })
        
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        
        if let popover = alert.popoverPresentationController {
            popover.sourceView = historyButton
            popover.sourceRect = historyButton.bounds
        }
        
        present(alert, animated: true)
    }
    
    private func loadHistoryItem(_ item: HistoryItem) {
        if let url = URL(string: item.url) {
            webView.load(URLRequest(url: url))
        }
    }
    
    private func addHistoryItem(url: String, title: String, providerName: String) {
        // 移除重复项
        history.removeAll { $0.url == url }
        
        let item = HistoryItem(url: url, title: title, providerName: providerName, dateVisited: Date())
        history.insert(item, at: 0)
        
        // 限制历史记录数量
        if history.count > 100 {
            history = Array(history.prefix(100))
        }
        
        saveHistory()
    }
    
    private func saveHistory() {
        if let data = try? JSONEncoder().encode(history) {
            UserDefaults.standard.set(data, forKey: "AIHistory")
        }
    }
    
    private func loadHistory() {
        if let data = UserDefaults.standard.data(forKey: "AIHistory"),
           let saved = try? JSONDecoder().decode([HistoryItem].self, from: data) {
            history = saved
        }
    }
    
    // MARK: - App Lifecycle
    @objc private func appWillResignActive() {
        // 保存当前状态
        saveCurrentState()
    }
    
    @objc private func appDidBecomeActive() {
        // 返回前台时不做任何操作，保持当前页面
        print("[AISidebar] App became active, keeping current state")
    }
    
    private func saveCurrentState() {
        // 保存当前 URL 和选中的 provider
        if let currentURL = webView.url?.absoluteString {
            UserDefaults.standard.set(currentURL, forKey: "AILastURL")
            UserDefaults.standard.set(selectedIndex, forKey: "AILastProviderIndex")
            print("[AISidebar] Saved state: \(currentURL)")
        }
    }
    
    private func restoreLastState() -> Bool {
        // 恢复上次的 URL
        guard let lastURL = UserDefaults.standard.string(forKey: "AILastURL"),
              let url = URL(string: lastURL) else {
            return false
        }
        
        selectedIndex = UserDefaults.standard.integer(forKey: "AILastProviderIndex")
        if selectedIndex >= providers.count {
            selectedIndex = 0
        }
        
        webView.load(URLRequest(url: url))
        sidebarCollectionView.reloadData()
        print("[AISidebar] Restored state: \(lastURL)")
        return true
    }
    
    // MARK: - Provider Order Persistence
    private func saveProviderOrder() {
        let order = providers.map { $0.id }
        UserDefaults.standard.set(order, forKey: "AIProviderOrder")
    }
    
    private func loadProviderOrder() {
        guard let savedOrder = UserDefaults.standard.array(forKey: "AIProviderOrder") as? [String] else { return }
        
        var orderedProviders: [AIProvider] = []
        for id in savedOrder {
            if let provider = providers.first(where: { $0.id == id }) {
                orderedProviders.append(provider)
            }
        }
        
        // 添加新的 provider（不在保存顺序中的）
        for provider in providers {
            if !orderedProviders.contains(where: { $0.id == provider.id }) {
                orderedProviders.append(provider)
            }
        }
        
        providers = orderedProviders
    }
}

// MARK: - UICollectionViewDelegate & DataSource
extension AISidebarViewController: UICollectionViewDelegate, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout, UICollectionViewDragDelegate, UICollectionViewDropDelegate {
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return providers.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "AIProviderCell", for: indexPath) as! AIProviderCell
        let provider = providers[indexPath.item]
        cell.configure(with: provider, isSelected: indexPath.item == selectedIndex)
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        loadProvider(at: indexPath.item)
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        return CGSize(width: 44, height: 44)
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, insetForSectionAt section: Int) -> UIEdgeInsets {
        return UIEdgeInsets(top: 8, left: 4, bottom: 8, right: 4)
    }
    
    // MARK: - Drag Delegate
    func collectionView(_ collectionView: UICollectionView, itemsForBeginning session: UIDragSession, at indexPath: IndexPath) -> [UIDragItem] {
        let provider = providers[indexPath.item]
        let itemProvider = NSItemProvider(object: provider.id as NSString)
        let dragItem = UIDragItem(itemProvider: itemProvider)
        dragItem.localObject = provider
        return [dragItem]
    }
    
    // MARK: - Drop Delegate
    func collectionView(_ collectionView: UICollectionView, dropSessionDidUpdate session: UIDropSession, withDestinationIndexPath destinationIndexPath: IndexPath?) -> UICollectionViewDropProposal {
        if collectionView.hasActiveDrag {
            return UICollectionViewDropProposal(operation: .move, intent: .insertAtDestinationIndexPath)
        }
        return UICollectionViewDropProposal(operation: .forbidden)
    }
    
    func collectionView(_ collectionView: UICollectionView, performDropWith coordinator: UICollectionViewDropCoordinator) {
        guard let destinationIndexPath = coordinator.destinationIndexPath else { return }
        
        for item in coordinator.items {
            if let sourceIndexPath = item.sourceIndexPath {
                collectionView.performBatchUpdates({
                    let movedProvider = providers.remove(at: sourceIndexPath.item)
                    providers.insert(movedProvider, at: destinationIndexPath.item)
                    collectionView.deleteItems(at: [sourceIndexPath])
                    collectionView.insertItems(at: [destinationIndexPath])
                    
                    // 更新选中索引
                    if selectedIndex == sourceIndexPath.item {
                        selectedIndex = destinationIndexPath.item
                    } else if sourceIndexPath.item < selectedIndex && destinationIndexPath.item >= selectedIndex {
                        selectedIndex -= 1
                    } else if sourceIndexPath.item > selectedIndex && destinationIndexPath.item <= selectedIndex {
                        selectedIndex += 1
                    }
                })
                coordinator.drop(item.dragItem, toItemAt: destinationIndexPath)
                
                // 保存顺序到 UserDefaults
                saveProviderOrder()
            }
        }
    }
}

// MARK: - WKNavigationDelegate
extension AISidebarViewController: WKNavigationDelegate {
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // 处理新窗口链接（target="_blank"）
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        decisionHandler(.allow)
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(.allow)
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("[AISidebar] Page loaded: \(webView.url?.absoluteString ?? "")")
        
        // 更新星标状态
        updateStarButton()
        
        // 添加到历史记录
        if let url = webView.url?.absoluteString {
            let title = webView.title ?? "未命名"
            let providerName = providers[selectedIndex].name
            addHistoryItem(url: url, title: title, providerName: providerName)
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[AISidebar] Navigation failed: \(error.localizedDescription)")
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("[AISidebar] Provisional navigation failed: \(error.localizedDescription)")
        
        // 显示错误提示
        let alert = UIAlertController(
            title: "加载失败",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "重试", style: .default) { [weak self] _ in
            self?.webView.reload()
        })
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        present(alert, animated: true)
    }
    
    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // 处理 SSL 证书
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

// MARK: - WKUIDelegate
extension AISidebarViewController: WKUIDelegate {
    
    // 处理 JavaScript alert
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }
    
    // 处理 JavaScript confirm
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true)
    }
    
    // 处理新窗口请求（window.open）
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // 在当前 webView 中打开
        if let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }
}

// MARK: - AIProviderCell
class AIProviderCell: UICollectionViewCell {
    
    private let iconImageView: UIImageView = {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFit
        iv.translatesAutoresizingMaskIntoConstraints = false
        iv.layer.cornerRadius = 8
        iv.clipsToBounds = true
        return iv
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        contentView.addSubview(iconImageView)
        
        NSLayoutConstraint.activate([
            iconImageView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 28),
            iconImageView.heightAnchor.constraint(equalToConstant: 28),
        ])
        
        layer.cornerRadius = 10
    }
    
    func configure(with provider: AIProvider, isSelected: Bool) {
        // 从 public/images/providers 目录加载图标（PNG 格式）
        if let path = Bundle.main.path(forResource: provider.icon, ofType: "png", inDirectory: "public/images/providers"),
           let image = UIImage(contentsOfFile: path) {
            iconImageView.image = image
        } else if let path = Bundle.main.path(forResource: provider.icon, ofType: "svg", inDirectory: "public/images/providers"),
                  let image = UIImage(contentsOfFile: path) {
            iconImageView.image = image
        } else {
            // 尝试从 Assets 加载
            iconImageView.image = UIImage(named: provider.icon)
        }
        
        // 选中状态
        if isSelected {
            layer.borderWidth = 2
            layer.borderColor = UIColor.systemBlue.cgColor
            backgroundColor = UIColor.systemBlue.withAlphaComponent(0.1)
        } else {
            layer.borderWidth = 0
            backgroundColor = .clear
        }
    }
}
