# Flocking simulation based on the Cucker-Smale model

This is a threejs simulation of the Cucker-Smale model, which is a dynamic model describing how birds reach consensus about the direction the flock is heading without a central direction defined. There are additional non-avian examples in the paper.

In summary, given a set of initial positions and velocities, the model assumes that each bird changes its velocity by considering the velocities of other birds in the flock and the distances to other birds in the flock. The model defines this by a weighted average of all the velocity differences relative to bird $i$, weighted by the coefficients $a_{ij}$:

$$\frac{d\mathbf{v}_i}{dt} = \frac{1}{N}\sum_{j=1}^{N} a_{ij}\{\mathbf{x}_i, \mathbf{x}_j\}(\mathbf{v}_j - \mathbf{v}_i)$$

where $N$ is the number of birds. The coefficients depend on the distance between birds $i$ and $j$ through a non-negative weight function $\psi$:

$$a_{ij} = \psi\left(\|\mathbf{x}_i - \mathbf{x}_j\|^2\right)$$

In the original model the weight function is

$$\psi(r) = \frac{K}{(1+r)^\beta}, \quad r \in \mathbb{R}_+$$

Please test around to see the conclusion the paper drew on how $\beta$ determines flock convergence or not. Hint: Answer is in the code comments, or even better, the paper itself!

## Sources

[Original CS model paper](https://people.mpi-inf.mpg.de/~mehlhorn/SeminarEvolvability/CuckerSmale.pdf)

Paper I originally saw the CS model in, [The Mathematical Theory of Behavioural Swarms: Towards Modelling the Collective Dynamics of Living Systems](https://arxiv.org/html/2508.12183v1#S5)