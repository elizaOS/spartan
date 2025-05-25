A Marketplace of Trust:
Extracting Reliable Recommendations through
Social Evaluation
Wit, Shaw and Partners at ai16z
Abstract
This paper presents a novel approach for evaluating the trustworthi-
ness of information in a decentralized, socially reinforced marketplace.
We propose a system in which an artificial intelligence (AI) agent places
bets in a virtual market based on recommendations from human users.
The real-world performance of the AI agent’s bets are used to assign each
user a ”trust score” representing their track record of providing reliable,
high-quality recommendations. These trust scores are publicly visible,
creating social incentives for users to build reputation by contributing
positively to the information market. We explore the economic incentives
and potential perverse incentives involved in such a system, as well as cur-
rent applications in investing and human-AI interaction along with future
applications in decentralized governance, content moderation, and open
source development. Our proposed Marketplace of Trust offers a novel
approach to aligning individual incentives with honest participation and
leveraging the wisdom of the crowd to surface trustworthy information.
1 Introduction
In an era characterized by information overload and rampant misinformation,
there is an urgent need for robust systems to assess the reliability of crowd-
sourced information. Effective trust management is critical for applications
ranging from content recommendation systems to decentralized governance.
However, existing trust and reputation systems often struggle to align indi-
vidual incentives with honest participation, making them vulnerable to gaming,
manipulation and attack [1].
To address this challenge, we propose a novel Marketplace of Trust in which
an AI agent evaluates the trustworthiness of information by placing bets based
on recommendations from human users. The real-world performance of these
bets are used to compute public trust scores for each user, representing their
personalized track record of providing reliable, high-quality recommendations.
By socially reinforcing honest participation through public reputation, our pro-
posed system aims to organically surface trustworthy information.
1
The use of an AI agent to mediate interactions and extract trust scores builds
on early work on conversational interfaces, most notably the ELIZA framework
developed by Joseph Weizenbaum in the 1960s [2]. ELIZA simulated a Rogerian
psychotherapist by pattern matching user inputs and generating appropriate
responses based on pre-defined scripts. Although ELIZA was a relatively simple
rule-based system, it demonstrated the potential for computers to engage in
apparently intelligent dialogue and elicit emotional responses from users [3].
In our proposed Marketplace of Trust, the AI agent serves a similar role in
facilitating natural interactions with human users, but with the added capability
of learning and adapting its behavior based on the observed outcomes of its bets.
This paper describes the key components and mechanisms of the Market-
place of Trust, including trust extraction through user recommendations, trust
evaluation via a betting market, and social reinforcement through public trust
profiles. We analyze the economic incentives created by this design and po-
tential vulnerabilities to perverse incentives. Lastly, we highlight promising
applications for the Marketplace of Trust, including financial investing, human-
AI interaction, decentralized governance, content moderation and open source
development.
The remainder of this paper is structured as follows: Section 2 provides
an overview of related work on trust management and collective intelligence.
Section 3 describes the core components and mechanisms of the Marketplace of
Trust system. Section 4 examines the economic incentives involved and analyzes
potential perverse incentives and vulnerabilities. Section 5 discusses current
and future applications of the system. Finally, Section 6 concludes and outlines
directions for future work.
2 Background and Related Work
Our proposed Marketplace of Trust builds on prior work in several distinct
but complementary areas, including trust and reputation systems, prediction
markets, and collective intelligence.
2.1 Trust and Reputation Systems
Trust and reputation systems aim to facilitate beneficial interactions between
agents in the absence of direct prior experience [4]. These systems commonly
aggregate feedback from past interactions to compute reputation scores for each
agent, which serve as a proxy for their trustworthiness [5]. Reputation systems
have been applied in diverse contexts including e-commerce [6], peer-to-peer
networks [7], and online communities [8].
However, many trust and reputation systems remain vulnerable to gaming
and manipulation [9]. Self-interested agents may collude to artificially inflate
their own reputation scores or attack the scores of others [10]. Sybil attacks, in
which an attacker creates multiple fake identities, pose another major challenge
[11]. Crucially, agents providing feedback on others often lack strong incentives
2
for honesty [9]. The Marketplace of Trust aims to mitigate these issues by tying
user reputation to the real-world performance of AI-placed bets, thus creating
direct economic incentives for providing reliable information.
2.2 Prediction Markets
Prediction markets are speculative markets designed to aggregate information
about uncertain future events [12]. Participants buy and sell contracts with
payoffs contingent on the outcomes of interest, such as election results or product
sales [13]. By leveraging the wisdom of the crowd, prediction markets aim to
generate forecasts that are more accurate than those of individual experts [14].
The Marketplace of Trust adapts ideas from prediction markets by having
an AI agent place bets based on crowdsourced user recommendations. Whereas
prediction markets typically focus on eliciting probabilistic forecasts, our pro-
posed system aims to surface trustworthy information and reputable agents.
Nonetheless, examining the strengths and limitations of real-world prediction
markets can yield valuable insights for designing a robust marketplace of trust.
2.3 Collective Intelligence
At a high level, the Marketplace of Trust harnesses the collective intelligence
of a user population to identify reliable information. Collective intelligence
refers to the ability of groups to make smarter decisions and more accurate
judgments than individual experts [15]. By aggregating diverse information,
perspectives and heuristics, collectives can display emergent intelligence that
transcends individual ability [16]. Well-known examples of collective intelligence
include crowdsourcing [17], open source software development [18], and citizen
science [19].
While the Marketplace of Trust aggregates individual recommendations indi-
rectly through an AI betting agent, the system aims to leverage crowd wisdom
to surface high-quality information. In addition, the use of a public reputa-
tion system creates social incentives for productive collaboration and healthy
competition among users to establish expertise. Designing effective incentive
structures is crucial for eliciting socially beneficial collective intelligence [20].
3 Marketplace of Trust: System Components
The Marketplace of Trust consists of three core components: (1) trust extrac-
tion through user recommendations, (2) trust evaluation through an AI betting
market, and (3) social reinforcement through public trust profiles. This section
describes each component in detail.
3.1 Trust Extraction
The first step in the Marketplace of Trust pipeline is eliciting recommendations
from human users. Users can offer recommendations in the form of free-text
3
justifications, numeric ratings, or other domain-specific formats. For example,
in a financial investing context, a user might recommend buying a particular
stock and provide a written rationale for their recommendation. In a content
moderation setting, a user might flag a post as misinformation and cite specific
factual inaccuracies.
To minimize barriers to participation, the system should make the recom-
mendation process as lightweight and intuitive as possible. Users should be
able to easily browse relevant information, search for particular topics, and
submit recommendations with minimal friction. At the same time, the user
interface should be designed to encourage substantive, high-quality recommen-
dations rather than low-effort spam.
Depending on the application context, user recommendations may be weighted
differently based on the user’s prior history and trust score within the system.
For example, recommendations from users with consistently high trust scores
may be given higher priority or visibility. Likewise, the system may limit the fre-
quency or volume of recommendations from new or untrusted users to mitigate
spam and Sybil attacks.
3.2 Trust Evaluation
The core innovation of the Marketplace of Trust lies in the trust evaluation
module. Rather than directly convert user recommendations into trust scores,
the system employs an AI agent to place bets in a virtual market based on the
user recommendations.
For each recommendation, the AI agent wagers a certain amount of virtual
currency on the expected outcome. The size of the bet is proportional to the
AI’s confidence in the recommendation, which is based on factors such as the
user’s prior track record, the specificity and scope of the recommendation, and
the degree of agreement with other recommendations in the system. Depend-
ing on the domain, the AI agent may use various natural language processing
and machine learning techniques to parse the recommendation text and extract
structured signals.
Once the AI agent places a bet, the market is resolved based on real-world
outcomes. The exact implementation depends on the application context, but
the key requirement is that ground truth outcomes must be observable and
objective. In a financial context, the AI’s bets on stock recommendations would
be settled based on the actual market prices after a specified time period. In a
content moderation setting, AI bets on post classifications may be resolved by
majority vote of trusted moderators.
After a bet is resolved, the AI agent’s payout (positive or negative) is used
to update the trust score of the user who provided the original recommenda-
tion. Reliable recommendations that lead to successful bets result in trust score
increases, while faulty recommendations that lead to losses decrease the trust
score. The size of the trust score adjustment may be a nonlinear function of the
bet outcome, the user’s prior trust score, and other contextual factors.
4
To smooth trust scores over time and adapt to changing user behavior, the
trust evaluation module may employ a multi-armed bandit algorithm [21]. This
approach allows the system to explore new and untested users while exploiting
the recommendations of proven high-quality users. More sophisticated explo-
ration strategies may be used to handle adversarial settings where users in-
tentionally make misleading recommendations to manipulate their trust scores
[22].
3.3 Social Reinforcement
The final component of the Marketplace of Trust is the social reinforcement
module, which publishes user trust scores and leverages social incentives to
encourage honest, productive participation.
Each user has a public trust profile displaying their current trust score and
recommendation history. Trust scores are normalized to an intuitive scale (e.g.,
0 to 100) and may be broken down by topic or category depending on the
application domain. Users may also have the option to add a short bio or links
to external profiles to establish their qualifications and expertise.
The visibility of trust profiles creates a powerful incentive for users to build
and maintain a positive reputation within the community. High trust scores
serve as social proof of a user’s expertise and reliability, which may translate
into status, influence, and other external opportunities. For example, in an
investment context, traders with high trust scores may attract more clients
or better employment options. In open source software development, high-
reputation contributors may be more likely to have their code accepted into
important projects.
At the same time, the social reinforcement module must be designed to
mitigate excessive competition, harassment, and other adversarial dynamics.
Users should be able to flag trust profiles that violate community guidelines (e.g.,
personal attacks, hate speech), with clear procedures for moderation and conflict
resolution. The user interface should emphasize the constructive purpose of
trust profiles in surfacing reliable information rather than encouraging personal
rivalries or animosity.
The social reinforcement module may also incorporate explicit community-
building features such as discussion forums, collaborative projects, and peer
mentoring. By fostering a sense of shared purpose and collective intelligence,
these features can align individual incentives with the overall quality and in-
tegrity of the information ecosystem. Over time, the Marketplace of Trust aims
to cultivate a self-sustaining community of experts who are intrinsically moti-
vated to contribute high-quality recommendations for the benefit of all.
4 Economic Incentives Analysis
The Marketplace of Trust is fundamentally an economic system that aims to
incentivize honest, high-quality information sharing. This section examines the
5
economic incentives created by the system design and identifies potential per-
verse incentives and vulnerabilities.
4.1 Incentive Alignment
The primary incentive mechanism in the Marketplace of Trust is the tight feed-
back loop between user recommendations, AI betting outcomes, and public trust
scores. By linking trust scores to the real-world performance of AI bets, the sys-
tem creates a direct economic incentive for users to provide reliable, high-quality
recommendations. Users who consistently make recommendations that lead to
positive betting outcomes are rewarded with high trust scores, while users who
make poor or misleading recommendations see their scores decline.
This incentive structure differs from traditional prediction market designs,
which typically reward participants based on the accuracy of their own proba-
bilistic forecasts [13]. In the Marketplace of Trust, users are rewarded not for
their own bets but for the quality of the recommendations they provide to the
AI agent. This creates a more robust incentive alignment by tying rewards to
objective, observable outcomes rather than self-reported predictions.
The public visibility of trust profiles further reinforces the economic incen-
tives by adding a social dimension. High trust scores serve as a form of social
capital that users can leverage for status, influence, and external opportunities.
The desire to maintain a positive reputation can discourage users from making
low-quality or malicious recommendations that could damage their standing
within the community.
4.2 Perverse Incentives
Despite the alignment of economic incentives, the Marketplace of Trust may still
be vulnerable to certain perverse incentives and adversarial behaviors. One po-
tential issue is the exploitation of information asymmetries. Users with insider
knowledge or privileged access to information may be able to make highly con-
fident recommendations that are difficult for others to verify or challenge. This
could lead to a concentration of trust scores among a small group of insiders,
undermining the system’s goal of surfacing crowdsourced wisdom.
Another perverse incentive is the temptation to game the system by making
a large number of low-risk, low-value recommendations. If the AI agent’s betting
strategy is not sufficiently calibrated, users may be able to accumulate high trust
scores simply by making many small, safe bets rather than taking on riskier
but potentially more informative bets. This could lead to an proliferation of
low-quality recommendations that do little to advance the overall information
ecosystem.
Collusion and Sybil attacks pose another challenge to the integrity of the
Marketplace of Trust. Self-interested users may coordinate to upvote each
other’s recommendations or create multiple fake profiles to artificially inflate
their trust scores. While the system’s reliance on objective betting outcomes
6
mitigates this risk compared to traditional reputation systems, sufficiently so-
phisticated attackers may still be able to exploit certain betting strategies or
market inefficiencies.
Finally, the social reinforcement mechanisms intended to cultivate a con-
structive community ethos may lead to unintended consequences such as group
polarization [23] or herd behavior [24]. If the system inadvertently creates echo
chambers where dissenting opinions are suppressed, the quality and diversity of
information may suffer. Users may also be tempted to simply follow the recom-
mendations of high-trust users rather than thinking critically for themselves.
4.3 Mitigation Strategies
To address these potential perverse incentives and vulnerabilities, the Market-
place of Trust must incorporate a range of mitigation strategies and safeguards:
• Encouraging diversity: The system should actively encourage a di-
versity of perspectives and information sources to mitigate the risk of
information asymmetries and echo chambers. This may involve explicitly
rewarding novel or contrarian recommendations that prove to be accurate.
• Reputation staking: To discourage low-effort gaming, the system may
require users to stake a portion of their existing reputation on each rec-
ommendation they make. This creates a disincentive to make frivolous
or bad-faith recommendations, as the potential reputation loss outweighs
the gain.
• Anomaly detection: The trust evaluation module should incorporate
anomaly detection algorithms to identify and flag unusual betting patterns
that may indicate collusion or Sybil attacks. Suspicious accounts can be
temporarily suspended pending further investigation.
• Community moderation: The social reinforcement module should in-
clude robust community moderation features to identify and address trolling,
harassment and other bad behavior. Clear guidelines and transparent en-
forcement can help maintain a healthy community culture.
• Randomized auditing: To deter gaming and maintain confidence in the
system, a random sample of recommendations and bets should be audited
for irregularities. The mere possibility of audits can discourage attempts
to exploit the system.
Ultimately, no system is entirely immune to adversarial behavior. The key
is to design an architecture with layered defenses and to remain vigilant in
monitoring for potential exploits. By combining economic incentives with social
norms and technical safeguards, the Marketplace of Trust aims to be a robust
and antifragile information ecosystem.
7
5 Applications
The Marketplace of Trust has a wide range of potential applications spanning
multiple domains. This section highlights two promising near-term applications
in investing and human-AI interaction, as well as several longer-term possibilities
in decentralized governance, content moderation, and open source development.
5.1 Investing and Trading
One of the most immediate applications of the Marketplace of Trust is in the
domain of investing and trading. There is an enormous amount of financial
information and advice available online, but the quality and reliability of this
information varies widely. Retail investors often struggle to distinguish signal
from noise, leaving them vulnerable to misinformation and manipulation.
The Marketplace of Trust could serve as a valuable tool for investors by ag-
gregating and filtering crowdsourced investment recommendations. Users could
submit stock picks, market analyses, and other financial insights, which would
be evaluated by an AI agent placing virtual bets. Over time, the system would
identify the most reliable and consistently profitable sources of investment ad-
vice, as reflected in their trust scores.
Investors could use the Marketplace of Trust to discover and follow high-
reputation experts in particular sectors or asset classes. The social reinforcement
mechanisms could also facilitate
6 Conclusion
The Marketplace of Trust represents a promising new approach to filtering and
curating crowdsourced information through the power of social reinforcement
and artificial intelligence. By combining economic incentives for honesty with
the wisdom of the crowd, our proposed system aims to robustly surface reliable,
high-quality information and mitigate the spread of misinformation.
The integration of an AI agent that engages in direct dialogue with hu-
man users builds on early work on conversational interfaces like ELIZA, while
extending these ideas with the capacity for economic reasoning and reputation
management. This unique combination of AI mediation and social incentives of-
fers a powerful toolkit for eliciting trustworthy recommendations and leveraging
the collective intelligence of online communities.
While the Marketplace of Trust offers an attractive and intuitive approach
to decentralized trust management, significant challenges remain in combating
potential vulnerabilities and perverse incentives. Further research is needed to
develop robust anomaly detection algorithms, community moderation practices,
and other defense mechanisms outlined in this paper. Empirical studies and
simulations of market dynamics under various adversarial conditions could yield
valuable insights to inform the real-world implementation of such a system.
8
Looking ahead, we believe the Marketplace of Trust has enormous potential
to transform the way humans and AI systems interact and collaborate to solve
complex informational challenges. From investing and content recommendation
to governance and open source development, our proposed architecture provides
a flexible and powerful framework for harnessing the best of both human and
machine intelligence. As the digital information landscape continues to evolve,
the Marketplace of Trust points the way towards a more reliable, transparent
and socially beneficial online ecosystem.
References
[1] Weizenbaum, J. (1966). ELIZA—a computer program for the study of nat-
ural language communication between man and machine. Communications
of the ACM, 9(1), 36-45.
[2] Turkle, S. (1984). The second self: Computers and the human spirit. New
York: Simon and Schuster.
9
