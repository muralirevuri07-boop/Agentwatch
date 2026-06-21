from setuptools import setup, find_packages
 
setup(
    name="agentwatch-sdk",
    version="1.0.0",
    author="Murali Revuri",
    author_email="muralirevuri07@gmail.com",
    description="Universal Governance Monitoring for Autonomous AI Agents",
    long_description=open("README.md").read() if __import__("os").path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    url="https://github.com/muralirevuri07-boop/agentwatch",
    packages=find_packages(),
    install_requires=["requests>=2.28.0"],
    extras_require={
        "langchain": ["langchain>=0.1.0"],
        "langgraph": ["langgraph>=0.0.1"],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
    ],
    keywords="ai governance agents monitoring langchain langgraph",
)
 




























