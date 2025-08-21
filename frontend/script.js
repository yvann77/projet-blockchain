// Configuration et variables globales
let web3Provider;
let contract;
let userAccount;
let isOwner = false;
let selectedCandidate = null;

// ABI du contrat avec les nouvelles fonctions
const CONTRACT_ABI = [
    "function votingTitle() view returns (string)",
    "function votingActive() view returns (bool)",
    "function votingEnded() view returns (bool)",
    "function candidatesCount() view returns (uint256)",
    "function totalVotes() view returns (uint256)",
    "function owner() view returns (address)",
    "function vote(uint256 _candidateId)",
    "function startVoting()",
    "function endVoting()",
    "function resetVoting(string _newTitle)",
    "function resetMultipleVoters(address[] _voters)",
    "function getAllCandidates() view returns (tuple(uint256 id, string name, uint256 voteCount)[])",
    "function getVotingStatus() view returns (string, bool, bool, uint256, uint256)",
    "function getVoterInfo(address _voter) view returns (bool, bool, uint256)",
    "function getWinningCandidate() view returns (uint256, string, uint256)",
    "event VoteCasted(address indexed voter, uint256 indexed candidateId)",
    "event VotingStarted()",
    "event VotingEnded()",
    "event VotingReset()"
];

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Vérification des dépendances au début du fichier script.js
console.log('🔍 Vérification des dépendances...');

// Vérifier ethers.js
if (typeof ethers === 'undefined') {
    console.error('❌ ethers is not defined');
    alert('Erreur: La librairie ethers.js n\'est pas chargée. Rechargez la page.');
    throw new Error('ethers.js not loaded');
} else {
    console.log('✅ ethers.js est disponible, version:', ethers.version);
}

// Vérifier MetaMask
if (typeof window.ethereum === 'undefined') {
    console.warn('⚠️ MetaMask n\'est pas détecté');
} else {
    console.log('✅ MetaMask détecté');
}

async function initializeApp() {
    console.log('🚀 Initialisation de l\'application...');
    
    // Vérifier si MetaMask est installé
    if (typeof window.ethereum === 'undefined') {
        showToast('MetaMask n\'est pas installé. Veuillez l\'installer pour utiliser cette application.', 'error');
        return;
    }
    
    // Vérifier si l'utilisateur est déjà connecté
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de la connexion:', error);
    }
}

function setupEventListeners() {
    // Bouton de connexion MetaMask
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    
    // Boutons administrateur
    document.getElementById('startVoting').addEventListener('click', startVoting);
    document.getElementById('endVoting').addEventListener('click', endVoting);
    document.getElementById('resetVoting').addEventListener('click', resetVoting); // ✨ NOUVEAU
    document.getElementById('refreshData').addEventListener('click', loadVotingData);
    
    // Bouton de vote
    document.getElementById('submitVote').addEventListener('click', submitVote);
    
    // Écouter les changements de compte MetaMask
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
    }
}

async function connectWallet() {
    try {
        showLoading('Connexion à MetaMask...');
        
        // Demander la connexion à MetaMask
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        if (accounts.length === 0) {
            throw new Error('Aucun compte sélectionné');
        }
        
        userAccount = accounts[0];
        
        // Configurer le provider ethers
        web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Vérifier le réseau
        const network = await web3Provider.getNetwork();
        if (network.chainId !== 1337) {
            showToast('Veuillez vous connecter au réseau Hardhat local (Chain ID: 1337)', 'warning');
        }
        
        // Initialiser le contrat
        if (typeof CONTRACT_INFO !== 'undefined') {
            contract = new ethers.Contract(
                CONTRACT_INFO.contractAddress,
                CONTRACT_ABI,
                web3Provider.getSigner()
            );
            
            // Vérifier si l'utilisateur est le propriétaire
            const owner = await contract.owner();
            isOwner = owner.toLowerCase() === userAccount.toLowerCase();
            
            console.log('✅ Contrat initialisé:', CONTRACT_INFO.contractAddress);
            console.log('👤 Compte utilisateur:', userAccount);
            console.log('🔑 Est propriétaire:', isOwner);
        } else {
            throw new Error('Informations du contrat non disponibles');
        }
        
        updateConnectionStatus(true);
        await loadVotingData();
        hideLoading();
        
        showToast('Connexion réussie !', 'success');
        
    } catch (error) {
        console.error('Erreur de connexion:', error);
        hideLoading();
        showToast('Erreur de connexion: ' + error.message, 'error');
    }
}

async function loadVotingData() {
    if (!contract) return;
    
    try {
        showLoading('Chargement des données...');
        
        // Charger les informations du vote
        const [title, active, ended, candidatesCount, totalVotes] = await contract.getVotingStatus();
        
        // Mettre à jour l'interface
        document.getElementById('votingTitle').textContent = title;
        document.getElementById('totalVotes').textContent = totalVotes.toString();
        
        let statusText = 'Inactif';
        let statusClass = 'inactive';
        
        if (ended) {
            statusText = 'Terminé';
            statusClass = 'ended';
        } else if (active) {
            statusText = 'Actif';
            statusClass = 'active';
        }
        
        const statusElement = document.getElementById('votingStatus');
        statusElement.textContent = statusText;
        statusElement.className = `value status ${statusClass}`;
        
        // Charger les informations de l'électeur
        const [isRegistered, hasVoted, votedCandidateId] = await contract.getVoterInfo(userAccount);
        
        let voterStatusText = 'Non enregistré';
        if (isRegistered) {
            voterStatusText = hasVoted ? `A voté (Candidat #${votedCandidateId})` : 'Enregistré, peut voter';
        }
        document.getElementById('voterStatus').textContent = voterStatusText;
        
        // Charger les candidats
        await loadCandidates(active && !ended && isRegistered && !hasVoted);
        
        // Afficher les résultats si le vote est terminé
        if (ended) {
            await loadResults();
        }
        
        // Afficher les sections appropriées
        updateUIVisibility(active, ended, isRegistered, hasVoted);
        
        hideLoading();
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        hideLoading();
        showToast('Erreur lors du chargement: ' + error.message, 'error');
    }
}

async function loadCandidates(canVote = false) {
    try {
        const candidates = await contract.getAllCandidates();
        const grid = document.getElementById('candidatesGrid');
        
        grid.innerHTML = '';
        
        candidates.forEach(candidate => {
            const candidateCard = document.createElement('div');
            candidateCard.className = `candidate-card ${!canVote ? 'disabled' : ''}`;
            candidateCard.dataset.candidateId = candidate.id.toString();
            
            candidateCard.innerHTML = `
                <div class="candidate-name">${candidate.name}</div>
                <div class="candidate-votes">${candidate.voteCount} votes</div>
            `;
            
            if (canVote) {
                candidateCard.addEventListener('click', () => selectCandidate(candidate.id));
            }
            
            grid.appendChild(candidateCard);
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des candidats:', error);
        showToast('Erreur lors du chargement des candidats', 'error');
    }
}

function selectCandidate(candidateId) {
    // Désélectionner tous les candidats
    document.querySelectorAll('.candidate-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Sélectionner le candidat cliqué
    const selectedCard = document.querySelector(`[data-candidate-id="${candidateId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCandidate = candidateId;
        
        // Afficher le bouton de vote
        document.getElementById('submitVote').style.display = 'block';
    }
}

async function submitVote() {
    if (!selectedCandidate) {
        showToast('Veuillez sélectionner un candidat', 'warning');
        return;
    }
    
    try {
        showLoading('Envoi du vote...');
        
        const tx = await contract.vote(selectedCandidate);
        
        showLoading('Confirmation de la transaction...');
        await tx.wait();
        
        hideLoading();
        showToast('Vote envoyé avec succès !', 'success');
        
        // Recharger les données
        await loadVotingData();
        
    } catch (error) {
        console.error('Erreur lors du vote:', error);
        hideLoading();
        
        let errorMessage = 'Erreur lors du vote';
        if (error.message.includes('deja vote')) {
            errorMessage = 'Vous avez déjà voté';
        } else if (error.message.includes('not active')) {
            errorMessage = 'Le vote n\'est pas actif';
        } else if (error.message.includes('not registered')) {
            errorMessage = 'Vous n\'êtes pas enregistré comme électeur';
        }
        
        showToast(errorMessage, 'error');
    }
}

async function startVoting() {
    if (!isOwner) {
        showToast('Seul le propriétaire peut démarrer le vote', 'error');
        return;
    }
    
    try {
        showLoading('Démarrage du vote...');
        
        const tx = await contract.startVoting();
        await tx.wait();
        
        hideLoading();
        showToast('Vote démarré avec succès !', 'success');
        
        await loadVotingData();
        
    } catch (error) {
        console.error('Erreur lors du démarrage:', error);
        hideLoading();
        showToast('Erreur lors du démarrage: ' + error.message, 'error');
    }
}

async function endVoting() {
    if (!isOwner) {
        showToast('Seul le propriétaire peut terminer le vote', 'error');
        return;
    }
    
    try {
        showLoading('Arrêt du vote...');
        
        const tx = await contract.endVoting();
        await tx.wait();
        
        hideLoading();
        showToast('Vote terminé avec succès !', 'success');
        
        await loadVotingData();
        
    } catch (error) {
        console.error('Erreur lors de l\'arrêt:', error);
        hideLoading();
        showToast('Erreur lors de l\'arrêt: ' + error.message, 'error');
    }
}

// ✨ NOUVELLE FONCTION RESET
async function resetVoting() {
    if (!isOwner) {
        showToast('Seul le propriétaire peut réinitialiser le vote', 'error');
        return;
    }
    
    // Demander confirmation
    const confirmation = confirm('Êtes-vous sûr de vouloir démarrer un nouveau vote ? Cela réinitialisera tous les résultats actuels.');
    if (!confirmation) return;
    
    try {
        showLoading('Réinitialisation du vote...');
        
        // Réinitialiser le vote avec un nouveau titre
        const newTitle = prompt('Nouveau titre pour le vote:', 'Nouvelle Élection 2025');
        if (!newTitle) {
            hideLoading();
            return;
        }
        
        const tx = await contract.resetVoting(newTitle);
        await tx.wait();
        
        // Reset des électeurs enregistrés
        showLoading('Réinitialisation des électeurs...');
        const voterAddresses = [
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
        ];
        
        const resetTx = await contract.resetMultipleVoters(voterAddresses);
        await resetTx.wait();
        
        hideLoading();
        showToast('Nouveau vote créé avec succès !', 'success');
        
        await loadVotingData();
        
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        hideLoading();
        showToast('Erreur lors de la réinitialisation: ' + error.message, 'error');
    }
}

async function loadResults() {
    try {
        const candidates = await contract.getAllCandidates();
        const totalVotes = await contract.totalVotes();
        
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';
        
        // Trier les candidats par nombre de votes (décroissant)
        const sortedCandidates = [...candidates].sort((a, b) => b.voteCount - a.voteCount);
        
        sortedCandidates.forEach(candidate => {
            const percentage = totalVotes > 0 ? (candidate.voteCount * 100 / totalVotes).toFixed(1) : 0;
            
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            resultItem.innerHTML = `
                <div class="result-candidate">${candidate.name}</div>
                <div class="result-votes">
                    <span class="vote-count">${candidate.voteCount} votes</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="vote-percentage">${percentage}%</span>
                </div>
            `;
            
            resultsContainer.appendChild(resultItem);
        });
        
        // Afficher le gagnant
        if (totalVotes > 0) {
            const [winnerId, winnerName, winnerVotes] = await contract.getWinningCandidate();
            
            const winnerInfo = document.getElementById('winnerInfo');
            winnerInfo.innerHTML = `
                <div>${winnerName}</div>
                <div>avec ${winnerVotes} votes</div>
            `;
            
            document.getElementById('winnerAnnouncement').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des résultats:', error);
        showToast('Erreur lors du chargement des résultats', 'error');
    }
}

function updateUIVisibility(votingActive, votingEnded, isRegistered, hasVoted) {
    // Sections principales
    document.getElementById('connectionSection').style.display = userAccount ? 'none' : 'block';
    document.getElementById('votingInfo').style.display = userAccount ? 'block' : 'none';
    
    // Contrôles administrateur
    document.getElementById('adminControls').style.display = isOwner && userAccount ? 'block' : 'none';
    
    // ✨ Afficher le bouton reset seulement si le vote est terminé
    document.getElementById('resetVoting').style.display = isOwner && votingEnded ? 'inline-flex' : 'none';
    
    // Section de vote
    const showVotingSection = userAccount && isRegistered && !hasVoted && votingActive && !votingEnded;
    document.getElementById('votingSection').style.display = showVotingSection ? 'block' : 'none';
    
    // Section des résultats
    document.getElementById('resultsSection').style.display = votingEnded && userAccount ? 'block' : 'none';
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    const icon = statusElement.querySelector('i');
    const text = statusElement.querySelector('span');
    
    if (connected) {
        statusElement.className = 'connection-status connected';
        icon.className = 'fas fa-check-circle';
        text.textContent = `Connecté (${userAccount.substring(0, 6)}...${userAccount.substring(38)})`;
    } else {
        statusElement.className = 'connection-status disconnected';
        icon.className = 'fas fa-times-circle';
        text.textContent = 'Non connecté';
    }
}

// Gestion des événements MetaMask
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        userAccount = null;
        contract = null;
        isOwner = false;
        updateConnectionStatus(false);
        updateUIVisibility(false, false, false, false);
        showToast('Compte MetaMask déconnecté', 'warning');
    } else if (accounts[0] !== userAccount) {
        await connectWallet();
    }
}

function handleChainChanged(chainId) {
    // Recharger la page si le réseau change
    window.location.reload();
}

// Fonctions utilitaires pour l'interface
function showLoading(message = 'Chargement...') {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fas fa-info-circle';
    if (type === 'success') icon = 'fas fa-check-circle';
    else if (type === 'error') icon = 'fas fa-exclamation-circle';
    else if (type === 'warning') icon = 'fas fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Supprimer le toast après 5 secondes
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Debug helpers
window.debugVoting = {
    getContract: () => contract,
    getAccount: () => userAccount,
    getIsOwner: () => isOwner,
    loadData: loadVotingData
};

console.log('🎯 Application de vote blockchain initialisée');
console.log('💡 Utilisez window.debugVoting pour déboguer');
