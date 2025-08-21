// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }
    
    struct Voter {
        bool hasVoted;
        uint256 votedCandidateId;
        bool isRegistered;
    }
    
    address public owner;
    string public votingTitle;
    bool public votingActive;
    bool public votingEnded;
    
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    
    uint256 public candidatesCount;
    uint256 public totalVotes;
    
    event VoteCasted(address indexed voter, uint256 indexed candidateId);
    event VotingStarted();
    event VotingEnded();
    event VotingReset();
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoterRegistered(address indexed voter);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Seul le proprietaire peut executer cette action");
        _;
    }
    
    modifier votingIsActive() {
        require(votingActive && !votingEnded, "Le vote n'est pas actif");
        _;
    }
    
    modifier hasNotVoted() {
        require(!voters[msg.sender].hasVoted, "Vous avez deja vote");
        _;
    }
    
    modifier isRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "Vous n'etes pas enregistre comme electeur");
        _;
    }
    
    constructor(string memory _title) {
        owner = msg.sender;
        votingTitle = _title;
        votingActive = false;
        votingEnded = false;
        candidatesCount = 0;
        totalVotes = 0;
    }
    
    function addCandidate(string memory _name) public onlyOwner {
        require(!votingActive, "Impossible d'ajouter des candidats pendant le vote");
        require(bytes(_name).length > 0, "Le nom du candidat ne peut pas etre vide");
        
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
        
        emit CandidateAdded(candidatesCount, _name);
    }
    
    function registerVoter(address _voter) public onlyOwner {
        require(!voters[_voter].isRegistered, "Cet electeur est deja enregistre");
        
        voters[_voter].isRegistered = true;
        voters[_voter].hasVoted = false;
        voters[_voter].votedCandidateId = 0;
        
        emit VoterRegistered(_voter);
    }
    
    function registerMultipleVoters(address[] memory _voters) public onlyOwner {
        for (uint256 i = 0; i < _voters.length; i++) {
            if (!voters[_voters[i]].isRegistered) {
                voters[_voters[i]].isRegistered = true;
                voters[_voters[i]].hasVoted = false;
                voters[_voters[i]].votedCandidateId = 0;
                emit VoterRegistered(_voters[i]);
            }
        }
    }
    
    function startVoting() public onlyOwner {
        require(candidatesCount > 0, "Il faut au moins un candidat pour commencer le vote");
        require(!votingActive, "Le vote est deja actif");
        require(!votingEnded, "Le vote est deja termine");
        
        votingActive = true;
        emit VotingStarted();
    }
    
    function vote(uint256 _candidateId) public votingIsActive hasNotVoted isRegisteredVoter {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Candidat invalide");
        
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedCandidateId = _candidateId;
        
        candidates[_candidateId].voteCount++;
        totalVotes++;
        
        emit VoteCasted(msg.sender, _candidateId);
    }
    
    function endVoting() public onlyOwner {
        require(votingActive, "Le vote n'est pas actif");
        require(!votingEnded, "Le vote est deja termine");
        
        votingActive = false;
        votingEnded = true;
        
        emit VotingEnded();
    }
    
    // ✨ NOUVELLE FONCTION POUR RESET LE VOTE
    function resetVoting(string memory _newTitle) public onlyOwner {
        require(votingEnded, "Le vote doit etre termine avant de pouvoir le reinitialiser");
        
        // Réinitialiser l'état du vote
        votingActive = false;
        votingEnded = false;
        totalVotes = 0;
        
        // Mettre à jour le titre si fourni
        if (bytes(_newTitle).length > 0) {
            votingTitle = _newTitle;
        }
        
        // Réinitialiser les votes des candidats
        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
        }
        
        emit VotingReset();
    }
    
    // ✨ FONCTION POUR RESET UN ÉLECTEUR SPÉCIFIQUE
    function resetVoter(address _voter) public onlyOwner {
        require(voters[_voter].isRegistered, "L'electeur n'est pas enregistre");
        voters[_voter].hasVoted = false;
        voters[_voter].votedCandidateId = 0;
    }
    
    // ✨ FONCTION POUR RESET PLUSIEURS ÉLECTEURS
    function resetMultipleVoters(address[] memory _voters) public onlyOwner {
        for (uint256 i = 0; i < _voters.length; i++) {
            if (voters[_voters[i]].isRegistered) {
                voters[_voters[i]].hasVoted = false;
                voters[_voters[i]].votedCandidateId = 0;
            }
        }
    }
    
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Candidat invalide");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }
    
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidatesCount);
        for (uint256 i = 1; i <= candidatesCount; i++) {
            allCandidates[i-1] = candidates[i];
        }
        return allCandidates;
    }
    
    function getVotingStatus() public view returns (string memory, bool, bool, uint256, uint256) {
        return (votingTitle, votingActive, votingEnded, candidatesCount, totalVotes);
    }
    
    function getVoterInfo(address _voter) public view returns (bool, bool, uint256) {
        Voter memory voter = voters[_voter];
        return (voter.isRegistered, voter.hasVoted, voter.votedCandidateId);
    }
    
    function getWinningCandidate() public view returns (uint256, string memory, uint256) {
        require(votingEnded, "Le vote n'est pas encore termine");
        require(candidatesCount > 0, "Aucun candidat");
        
        uint256 winningVoteCount = 0;
        uint256 winningCandidateId = 0;
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winningCandidateId = i;
            }
        }
        
        return (winningCandidateId, candidates[winningCandidateId].name, winningVoteCount);
    }
}
